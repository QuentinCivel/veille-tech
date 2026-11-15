<script setup lang="ts">
// Bandeau d'alerte en tête du site : failles critiques publiées ces 30 derniers jours.
const { data } = useFetch<ArticlePage>('/api/articles', {
  query: { critical: '1', limit: 3 },
  key: 'critical-banner'
})

const recent = computed(() => {
  const limit = Date.now() - 30 * 86_400_000
  return (data.value?.items ?? []).filter(article => new Date(article.publishedAt).getTime() > limit)
})
</script>

<template>
  <aside v-if="recent.length" role="alert" class="alert alert-error alert-soft mb-8 items-start border border-error/40" aria-labelledby="critical-title">
    <svg xmlns="http://www.w3.org/2000/svg" class="size-6 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clip-rule="evenodd" />
    </svg>
    <div class="w-full">
      <h2 id="critical-title" class="font-bold">
        {{ recent.length }} faille{{ recent.length > 1 ? 's' : '' }} critique{{ recent.length > 1 ? 's' : '' }} ces 30 derniers jours
      </h2>
      <ul class="mt-1 space-y-0.5 text-sm">
        <li v-for="article in recent" :key="article.id">
          <NuxtLink :to="`/articles/${article.id}`" class="link font-medium">{{ article.title }}</NuxtLink>
          <span class="opacity-70"> — <time :datetime="article.publishedAt">{{ formatDate(article.publishedAt) }}</time></span>
        </li>
      </ul>
    </div>
    <NuxtLink to="/?critical=1" class="btn btn-error btn-sm shrink-0">Tout voir</NuxtLink>
  </aside>
</template>
