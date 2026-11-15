<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Articles' })

const toast = useToast()
// Liste admin (technologies privées comprises), et non la liste publique.
const { data: technologies } = await useFetch<Technology[]>('/api/admin/technologies', { key: 'admin-technologies', default: () => [] })
const nameOf = (slug: string) => technologies.value?.find(tech => tech.slug === slug)?.name ?? slug

const status = ref<'' | ArticleStatus>('')
const type = ref<'' | ArticleType>('')
const search = ref('')
const debouncedSearch = useDebounced(search, 300)

const query = computed(() => ({
  status: status.value || undefined,
  type: type.value || undefined,
  q: debouncedSearch.value.trim() || undefined,
  limit: 30
}))

const { data, refresh, pending } = await useFetch<ArticlePage>('/api/admin/articles', { query })
const extra = ref<ArticleListItem[]>([])
const cursor = ref<string | null>(null)
watch(data, page => { extra.value = []; cursor.value = page?.nextCursor ?? null }, { immediate: true })
const items = computed(() => [...(data.value?.items ?? []), ...extra.value])

async function loadMore() {
  if (!cursor.value) return
  const page = await $fetch<ArticlePage>('/api/admin/articles', { query: { ...query.value, cursor: cursor.value } })
  extra.value.push(...page.items)
  cursor.value = page.nextCursor
}

async function remove(article: ArticleListItem) {
  if (!confirm(`Supprimer définitivement « ${article.title} » ?`)) return
  try {
    await $fetch(`/api/admin/articles/${article.id}`, { method: 'DELETE' })
    toast.success('Article supprimé.')
    await refresh()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
}

const alertLabels: Record<AlertState, string> = { none: '—', sending: 'En cours', sent: 'Envoyée', failed: 'Échec' }
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">Articles</h1>
      <NuxtLink to="/admin/articles/new" class="btn btn-primary">Nouvel article</NuxtLink>
    </div>

    <form class="flex flex-wrap gap-3" role="search" @submit.prevent>
      <label class="input flex-1">
        <span class="sr-only">Rechercher</span>
        <input v-model="search" type="search" placeholder="Rechercher…" maxlength="100">
      </label>
      <label class="select w-44">
        <span class="sr-only">Statut</span>
        <select v-model="status">
          <option value="">Tous les statuts</option>
          <option value="published">Publiés</option>
          <option value="draft">Brouillons</option>
        </select>
      </label>
      <label class="select w-52">
        <span class="sr-only">Type</span>
        <select v-model="type">
          <option value="">Tous les types</option>
          <option v-for="t in ARTICLE_TYPES" :key="t" :value="t">{{ TYPE_LABELS[t] }}</option>
        </select>
      </label>
    </form>

    <div class="overflow-x-auto rounded-box bg-base-100 shadow">
      <table class="table">
        <thead>
          <tr><th>Titre</th><th>Type</th><th>Technologies</th><th>Statut</th><th>Date</th><th>Alerte</th><th><span class="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="article in items" :key="article.id" :class="{ 'bg-error/5': article.isCritical }">
            <td class="max-w-md">
              <NuxtLink :to="`/admin/articles/${article.id}`" class="link link-hover font-medium">{{ article.title }}</NuxtLink>
              <p class="text-xs text-base-content/60">{{ article.sourceName }}</p>
            </td>
            <td>
              <div class="flex flex-col items-start gap-1">
                <TypeBadge :type="article.type" />
                <SeverityBadge v-if="article.severity" :severity="article.severity" />
              </div>
            </td>
            <td class="text-sm">{{ article.technologies.map(nameOf).join(', ') }}</td>
            <td>
              <span class="badge badge-sm" :class="article.status === 'published' ? 'badge-success' : 'badge-ghost'">
                {{ article.status === 'published' ? 'Publié' : 'Brouillon' }}
              </span>
              <span
                v-if="article.status === 'published' && !article.listed"
                class="badge badge-warning badge-soft badge-sm mt-1"
                title="Rattaché uniquement à des technologies privées : absent du site public"
              >Masqué du public</span>
            </td>
            <td class="whitespace-nowrap text-sm">{{ formatDate(article.publishedAt) }}</td>
            <td class="text-sm" :class="{ 'text-error': article.alert.state === 'failed' }">{{ alertLabels[article.alert.state] }}</td>
            <td class="whitespace-nowrap">
              <NuxtLink :to="`/articles/${article.id}`" class="btn btn-ghost btn-xs" target="_blank">Voir<span class="sr-only"> {{ article.title }}</span></NuxtLink>
              <button type="button" class="btn btn-ghost btn-xs text-error" @click="remove(article)">Supprimer<span class="sr-only"> {{ article.title }}</span></button>
            </td>
          </tr>
          <tr v-if="!items.length && !pending"><td colspan="7" class="text-center text-base-content/60">Aucun article.</td></tr>
        </tbody>
      </table>
    </div>
    <div v-if="cursor" class="text-center">
      <button type="button" class="btn btn-outline" @click="loadMore">Charger plus</button>
    </div>
  </div>
</template>
