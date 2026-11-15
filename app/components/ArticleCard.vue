<script setup lang="ts">
// Carte d'actualité du fil de veille (daisyUI "card").
// Trois niveaux visuels :
//  - faille CRITIQUE : bandeau rouge avec score CVSS, bordure épaisse, fond teinté ;
//  - autre faille de sécurité : bordure d'avertissement ;
//  - mise à jour / tutoriel / actualité : carte neutre.
const props = defineProps<{ article: ArticleListItem }>()

const { nameOf } = useTechnologies()

const isSecurity = computed(() => props.article.type === 'security')
const titleId = computed(() => `article-${props.article.id}`)

const cardClass = computed(() => {
  if (props.article.isCritical) return 'border-2 border-error bg-error/5 shadow-md shadow-error/10'
  if (isSecurity.value) return 'border border-warning/60 shadow-sm'
  return 'border border-base-content/10 shadow-sm'
})
</script>

<template>
  <!-- min-w-0 + overflow-wrap:anywhere : une URL longue dans un résumé ne doit jamais élargir la grille (mobile). -->
  <article class="card relative min-w-0 bg-base-100 transition-shadow [overflow-wrap:anywhere] hover:shadow-lg" :class="cardClass" :aria-labelledby="titleId">
    <!-- Bandeau réservé aux failles critiques : texte explicite + icône (pas seulement la couleur). -->
    <div
      v-if="article.isCritical"
      class="flex items-center gap-2 rounded-t-[inherit] bg-error px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-error-content"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-4 motion-safe:animate-pulse" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clip-rule="evenodd" />
      </svg>
      Faille critique
      <span v-if="article.cve?.cvss != null" class="ml-auto">CVSS {{ article.cve.cvss }}</span>
    </div>

    <div class="card-body gap-3 p-5">
      <div class="flex flex-wrap items-center gap-1.5">
        <TypeBadge :type="article.type" />
        <SeverityBadge v-if="article.severity && !article.isCritical" :severity="article.severity" :cvss="article.cve?.cvss" />
        <span v-if="article.version" class="badge badge-sm badge-ghost font-mono">{{ article.version }}</span>
      </div>

      <h2 :id="titleId" class="card-title text-lg leading-snug">
        <!-- Lien étiré : toute la carte est cliquable, mais un seul lien est annoncé aux lecteurs d'écran. -->
        <NuxtLink :to="`/articles/${article.id}`" class="after:absolute after:inset-0 hover:underline focus-visible:underline">
          {{ article.title }}
        </NuxtLink>
      </h2>

      <p v-if="article.summary" class="line-clamp-3 max-h-[3lh] text-sm text-base-content/75">{{ article.summary }}</p>

      <p v-if="article.cve?.ids.length" class="font-mono text-xs text-base-content/70">
        {{ article.cve.ids.slice(0, 3).join(' · ') }}
      </p>

      <div class="card-actions mt-auto items-center justify-between pt-2">
        <!-- relative z-10 : ces liens restent cliquables au-dessus du lien étiré. -->
        <ul class="relative z-10 flex flex-wrap gap-1" aria-label="Technologies concernées">
          <li v-for="slug in article.technologies" :key="slug">
            <NuxtLink :to="`/technologies/${slug}`" class="badge badge-outline badge-sm hover:badge-primary">
              {{ nameOf(slug) }}
            </NuxtLink>
          </li>
        </ul>
        <p class="text-xs text-base-content/60">
          <time :datetime="article.publishedAt">{{ formatDate(article.publishedAt) }}</time>
          <span v-if="article.sourceName"> · {{ article.sourceName }}</span>
        </p>
      </div>
    </div>
  </article>
</template>
