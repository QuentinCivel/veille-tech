<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: tech, error } = await useFetch<PublicTechnology>(() => `/api/technologies/${slug.value}`)
if (error.value || !tech.value) {
  throw createError({ statusCode: 404, statusMessage: 'Technologie introuvable', fatal: true })
}
const t = computed(() => tech.value!)

useSeoMeta({
  title: () => `Veille ${t.value.name}`,
  description: () => `Mises à jour, failles de sécurité et actualités de ${t.value.name}. ${t.value.description}`
})

const links = computed(() => [
  t.value.website && { href: t.value.website, label: 'Site officiel' },
  t.value.githubRepo && { href: `https://github.com/${t.value.githubRepo}`, label: 'GitHub' },
  t.value.npmPackage && { href: `https://www.npmjs.com/package/${t.value.npmPackage}`, label: 'npm' }
].filter((link): link is { href: string, label: string } => Boolean(link)))
</script>

<template>
  <div>
    <nav class="breadcrumbs mb-4 text-sm" aria-label="Fil d'Ariane">
      <ul>
        <li><NuxtLink to="/technologies">Technologies</NuxtLink></li>
        <li aria-current="page">{{ t.name }}</li>
      </ul>
    </nav>

    <header class="mb-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div>
        <p class="text-sm font-medium uppercase tracking-wide text-primary">{{ CATEGORY_LABELS[t.category] }}</p>
        <h1 class="text-3xl font-bold tracking-tight">{{ t.name }}</h1>
        <p class="mt-2 max-w-2xl text-base-content/70">{{ t.description }}</p>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li v-for="link in links" :key="link.href">
            <a :href="link.href" class="btn btn-sm btn-outline" target="_blank" rel="noopener noreferrer">
              {{ link.label }}<span class="sr-only"> de {{ t.name }} (nouvel onglet)</span>
            </a>
          </li>
        </ul>
      </div>
      <div class="rounded-box border border-base-content/10 bg-base-100 p-4 shadow-sm md:min-w-56">
        <VersionStatus :tech="t" />
      </div>
    </header>

    <ArticleFeed :fixed-tech="t.slug" />
  </div>
</template>
