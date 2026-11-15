<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: article, error } = await useFetch<ArticleDetail>(() => `/api/articles/${id.value}`)
if (error.value || !article.value) {
  throw createError({ statusCode: error.value?.statusCode ?? 404, statusMessage: 'Article introuvable', fatal: true })
}

const { nameOf } = useTechnologies()
const siteUrl = useRuntimeConfig().public.siteUrl

const a = computed(() => article.value!)
const isSecurity = computed(() => a.value.type === 'security')

/** Lien de référence pour un identifiant de faille. */
function advisoryUrl(identifier: string): string {
  return identifier.startsWith('GHSA-')
    ? `https://github.com/advisories/${identifier}`
    : `https://nvd.nist.gov/vuln/detail/${identifier}`
}

useSeoMeta({
  title: () => a.value.title,
  description: () => a.value.summary.slice(0, 160),
  ogTitle: () => a.value.title,
  ogDescription: () => a.value.summary.slice(0, 200),
  ogType: 'article',
  articlePublishedTime: () => a.value.publishedAt,
  robots: () => (a.value.status === 'published' ? 'index, follow' : 'noindex')
})

// Données structurées (schema.org) pour les moteurs de recherche.
useHead({
  link: [{ rel: 'canonical', href: () => `${siteUrl}/articles/${a.value.id}` }],
  script: [{
    type: 'application/ld+json',
    innerHTML: () => JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: a.value.title,
      description: a.value.summary,
      datePublished: a.value.publishedAt,
      dateModified: a.value.updatedAt,
      about: a.value.technologies.map(nameOf),
      ...(a.value.url ? { isBasedOn: a.value.url } : {})
    }).replace(/</g, '\\u003c')
  }]
})
</script>

<template>
  <article class="mx-auto max-w-3xl">
    <nav class="breadcrumbs mb-4 text-sm" aria-label="Fil d'Ariane">
      <ul>
        <li><NuxtLink to="/">Fil de veille</NuxtLink></li>
        <li v-if="a.technologies[0]">
          <NuxtLink :to="`/technologies/${a.technologies[0]}`">{{ nameOf(a.technologies[0]) }}</NuxtLink>
        </li>
        <li aria-current="page" class="max-w-[16rem] truncate">{{ a.title }}</li>
      </ul>
    </nav>

    <div v-if="a.status !== 'published'" role="status" class="alert alert-warning mb-4">
      Brouillon — visible uniquement par les administrateurs.
    </div>

    <header class="mb-6 space-y-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <TypeBadge :type="a.type" />
        <SeverityBadge v-if="a.severity" :severity="a.severity" :cvss="a.cve?.cvss" />
        <span v-if="a.version" class="badge badge-sm badge-ghost font-mono">{{ a.version }}</span>
      </div>
      <h1 class="text-2xl font-bold leading-tight md:text-3xl">{{ a.title }}</h1>
      <p class="text-sm text-base-content/70">
        Publié le <time :datetime="a.publishedAt">{{ formatDate(a.publishedAt) }}</time>
        <span v-if="a.sourceName"> · Source : {{ a.sourceName }}</span>
      </p>
      <ul class="flex flex-wrap gap-1.5" aria-label="Technologies concernées">
        <li v-for="slug in a.technologies" :key="slug">
          <NuxtLink :to="`/technologies/${slug}`" class="badge badge-outline hover:badge-primary">{{ nameOf(slug) }}</NuxtLink>
        </li>
      </ul>
    </header>

    <!-- Encadré sécurité : identifiants, score, versions touchées / corrigées (aucune info sur le projet suivi). -->
    <section
      v-if="isSecurity"
      class="mb-8 rounded-box border-2 p-5"
      :class="a.isCritical ? 'border-error bg-error/5' : 'border-warning bg-warning/5'"
      aria-labelledby="security-title"
    >
      <h2 id="security-title" class="mb-3 flex items-center gap-2 text-lg font-bold" :class="a.isCritical ? 'text-error' : ''">
        <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clip-rule="evenodd" />
        </svg>
        {{ a.isCritical ? 'Faille critique' : 'Faille de sécurité' }}
      </h2>

      <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <template v-if="a.cve?.ids.length">
          <dt class="font-semibold">Identifiants</dt>
          <dd class="flex flex-wrap gap-2 font-mono">
            <a v-for="cveId in a.cve.ids" :key="cveId" :href="advisoryUrl(cveId)" class="link" target="_blank" rel="noopener noreferrer">{{ cveId }}</a>
          </dd>
        </template>
        <template v-if="a.cve?.cvss != null">
          <dt class="font-semibold">Score CVSS</dt>
          <dd>{{ a.cve.cvss }} / 10</dd>
        </template>
        <template v-if="a.cve?.affectedRanges.length">
          <dt class="font-semibold">Versions touchées</dt>
          <dd class="font-mono">{{ a.cve.affectedRanges.join(' ; ') }}</dd>
        </template>
        <template v-if="a.cve?.patchedVersions.length">
          <dt class="font-semibold">Corrigé en</dt>
          <dd class="font-mono">{{ a.cve.patchedVersions.join(', ') }}</dd>
        </template>
      </dl>
    </section>

    <p v-if="a.summary && !a.contentHtml" class="text-lg">{{ a.summary }}</p>

    <!-- HTML assaini côté serveur (sanitize-html) : aucune balise script ni attribut d'événement. -->
    <div
      v-if="a.contentHtml"
      class="article-content prose prose-sm max-w-none md:prose-base prose-a:text-primary"
      v-html="a.contentHtml"
    />

    <footer class="mt-10 flex flex-wrap items-center gap-3 border-t border-base-content/10 pt-6">
      <a v-if="a.url" :href="a.url" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
        Lire la source officielle
        <span class="sr-only">(nouvel onglet)</span>
      </a>
      <NuxtLink to="/" class="btn btn-ghost">← Retour au fil</NuxtLink>
      <ul v-if="a.tags.length" class="ml-auto flex flex-wrap gap-1" aria-label="Tags">
        <li v-for="tag in a.tags" :key="tag">
          <NuxtLink :to="{ path: '/', query: { tag } }" class="badge badge-ghost hover:badge-secondary">#{{ tag }}</NuxtLink>
        </li>
      </ul>
    </footer>
  </article>
</template>
