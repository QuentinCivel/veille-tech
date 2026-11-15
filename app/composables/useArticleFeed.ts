import type { LocationQuery } from 'vue-router'

export interface FeedFilters {
  q: string
  tech: string
  type: ArticleType | ''
  tag: string
  critical: boolean
}

const first = (value: LocationQuery[string] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

/** Les filtres vivent dans l'URL : liens partageables, bouton "retour" du navigateur et rendu SSR cohérents. */
export function filtersFromQuery(query: LocationQuery): FeedFilters {
  const type = first(query.type)
  return {
    q: first(query.q),
    tech: first(query.tech),
    type: (ARTICLE_TYPES as string[]).includes(type) ? (type as ArticleType) : '',
    tag: first(query.tag),
    critical: first(query.critical) === '1'
  }
}

export function useArticleFeed(filters: Ref<FeedFilters>, pageSize = 18) {
  const apiQuery = computed(() => ({
    q: filters.value.q || undefined,
    tech: filters.value.tech || undefined,
    type: filters.value.type || undefined,
    tag: filters.value.tag || undefined,
    critical: filters.value.critical ? '1' : undefined,
    limit: pageSize
  }))

  // Première page : rendue côté serveur (SEO) puis rechargée automatiquement quand un filtre change.
  const { data, status, error } = useFetch<ArticlePage>('/api/articles', {
    query: apiQuery,
    key: computed(() => `feed:${JSON.stringify(apiQuery.value)}`)
  })

  const extraItems = ref<ArticleListItem[]>([])
  // Curseur des pages chargées via « Charger plus » (undefined = aucune encore).
  const extraCursor = ref<string | null | undefined>(undefined)
  const loadingMore = ref(false)
  const loadMoreError = ref<string | null>(null)

  // Dérivé (et non rempli par un watch) : les watchers ne s'exécutent pas pendant le rendu serveur,
  // le bouton « Charger plus » doit donc dépendre directement des données de la première page.
  const nextCursor = computed(() => (extraCursor.value !== undefined ? extraCursor.value : data.value?.nextCursor ?? null))

  // Changement de filtre → nouvelle première page : on oublie les pages supplémentaires.
  watch(data, () => {
    extraItems.value = []
    extraCursor.value = undefined
  })

  async function loadMore() {
    if (!nextCursor.value || loadingMore.value) return
    loadingMore.value = true
    loadMoreError.value = null
    try {
      const page = await $fetch<ArticlePage>('/api/articles', { query: { ...apiQuery.value, cursor: nextCursor.value } })
      extraItems.value.push(...page.items)
      extraCursor.value = page.nextCursor
    }
    catch {
      loadMoreError.value = 'Impossible de charger la suite. Réessayez.'
    }
    finally {
      loadingMore.value = false
    }
  }

  const items = computed(() => [...(data.value?.items ?? []), ...extraItems.value])
  return { items, status, error, hasMore: computed(() => Boolean(nextCursor.value)), loadMore, loadingMore, loadMoreError }
}
