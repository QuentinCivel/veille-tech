<script setup lang="ts">
// Fil d'actualités filtrable : recherche, type de contenu, technologie, tag, "critiques uniquement".
const props = defineProps<{ fixedTech?: string }>()

const route = useRoute()
const router = useRouter()
const { technologies } = useTechnologies()

const filters = computed<FeedFilters>(() => {
  const parsed = filtersFromQuery(route.query)
  return props.fixedTech ? { ...parsed, tech: props.fixedTech } : parsed
})
const { items, status, error, hasMore, loadMore, loadingMore, loadMoreError } = useArticleFeed(filters)

function updateQuery(patch: Partial<Record<keyof FeedFilters, string | boolean>>) {
  const query: Record<string, string> = {}
  const merged = { ...filters.value, ...patch }
  if (merged.q) query.q = String(merged.q)
  if (merged.tech && !props.fixedTech) query.tech = String(merged.tech)
  if (merged.type) query.type = String(merged.type)
  if (merged.tag) query.tag = String(merged.tag)
  if (merged.critical) query.critical = '1'
  router.replace({ query })
}

// Recherche : saisie locale, URL mise à jour après 300 ms sans frappe.
const search = ref(filters.value.q)
const debouncedSearch = useDebounced(search, 300)
watch(debouncedSearch, value => updateQuery({ q: value.trim() }))
watch(() => filters.value.q, (value) => {
  if (value !== search.value.trim()) search.value = value
})

const typeOptions: Array<{ value: ArticleType | '', label: string }> = [
  { value: '', label: 'Tout' },
  ...ARTICLE_TYPES.map(type => ({ value: type, label: TYPE_LABELS[type] }))
]

const hasFilters = computed(() => Boolean(filters.value.q || filters.value.type || filters.value.tag || filters.value.critical || (!props.fixedTech && filters.value.tech)))
const resultLabel = computed(() => {
  if (error.value) return ''
  if (status.value === 'pending') return 'Chargement…'
  const count = items.value.length
  return `${count}${hasMore.value ? '+' : ''} article${count > 1 ? 's' : ''}`
})
</script>

<template>
  <section aria-labelledby="feed-title">
    <h2 id="feed-title" class="sr-only">Articles de veille</h2>

    <form class="mb-6 space-y-4 rounded-box border border-base-content/10 bg-base-100 p-4 shadow-sm" role="search" @submit.prevent>
      <div class="flex flex-col gap-3 md:flex-row">
        <label class="input w-full md:flex-1">
          <svg class="size-4 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <span class="sr-only">Rechercher</span>
          <input v-model="search" type="search" placeholder="Rechercher (ex. RCE, 4.6, CVE-2026…)" maxlength="100" autocomplete="off">
        </label>

        <label v-if="!fixedTech" class="select w-full md:w-60">
          <span class="sr-only">Technologie</span>
          <select :value="filters.tech" @change="updateQuery({ tech: ($event.target as HTMLSelectElement).value })">
            <option value="">Toutes les technologies</option>
            <option v-for="tech in technologies" :key="tech.slug" :value="tech.slug">{{ tech.name }}</option>
          </select>
        </label>

        <label class="label cursor-pointer gap-2 whitespace-nowrap text-base-content">
          <input
            type="checkbox"
            class="toggle toggle-error"
            :checked="filters.critical"
            @change="updateQuery({ critical: ($event.target as HTMLInputElement).checked })"
          >
          Critiques uniquement
        </label>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="join flex-wrap" role="group" aria-label="Type de contenu">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            class="btn join-item btn-sm"
            :class="filters.type === option.value ? 'btn-primary' : 'btn-ghost'"
            :aria-pressed="filters.type === option.value"
            @click="updateQuery({ type: option.value })"
          >
            {{ option.label }}
          </button>
        </div>

        <span v-if="filters.tag" class="badge badge-secondary gap-1">
          #{{ filters.tag }}
          <button type="button" class="cursor-pointer" :aria-label="`Retirer le tag ${filters.tag}`" @click="updateQuery({ tag: '' })">✕</button>
        </span>

        <button v-if="hasFilters" type="button" class="btn btn-link btn-sm ml-auto" @click="search = ''; updateQuery({ q: '', tech: '', type: '', tag: '', critical: false })">
          Réinitialiser les filtres
        </button>
      </div>
    </form>

    <p class="mb-4 text-sm text-base-content/70" aria-live="polite">{{ resultLabel }}</p>

    <div v-if="error" role="alert" class="alert alert-error">
      <span>Le fil de veille est momentanément indisponible.</span>
    </div>

    <div v-else-if="status === 'pending' && !items.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="skeleton h-56 w-full" />
    </div>

    <div v-else-if="!items.length" class="rounded-box border border-dashed border-base-content/20 p-10 text-center">
      <p class="font-semibold">Aucun article ne correspond à ces critères.</p>
      <p class="mt-1 text-sm text-base-content/70">Essayez d'élargir la recherche ou de retirer un filtre.</p>
    </div>

    <template v-else>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="article in items" :key="article.id" class="flex min-w-0 [&>*]:w-full">
          <ArticleCard :article="article" />
        </li>
      </ul>

      <div class="mt-8 flex flex-col items-center gap-2">
        <p v-if="loadMoreError" role="alert" class="text-sm text-error">{{ loadMoreError }}</p>
        <button v-if="hasMore" type="button" class="btn btn-outline" :disabled="loadingMore" @click="loadMore">
          <span v-if="loadingMore" class="loading loading-spinner loading-sm" aria-hidden="true" />
          Charger plus d'articles
        </button>
      </div>
    </template>
  </section>
</template>
