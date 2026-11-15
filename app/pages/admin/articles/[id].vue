<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { data: article, error, refresh } = await useFetch<Article>(() => `/api/admin/articles/${route.params.id}`)
useSeoMeta({ title: () => article.value?.title ?? 'Article' })

const resending = ref(false)
async function resendAlert() {
  if (!article.value || !confirm('Renvoyer l\'alerte e-mail à tous les destinataires concernés ?')) return
  resending.value = true
  try {
    const result = await $fetch<Parameters<typeof describeDispatch>[0]>(`/api/admin/articles/${article.value.id}/alert`, { method: 'POST' })
    const info = describeDispatch(result)
    if (info) toast[info.type](info.message)
    await refresh()
  }
  catch (err) {
    toast.error(apiErrorMessage(err))
  }
  finally {
    resending.value = false
  }
}

const alertLabels: Record<AlertState, string> = {
  none: 'Aucune alerte envoyée',
  sending: 'Envoi en cours',
  sent: 'Alerte envoyée',
  failed: 'Échec de l\'alerte'
}
</script>

<template>
  <div class="space-y-6">
    <nav class="breadcrumbs text-sm" aria-label="Fil d'Ariane">
      <ul>
        <li><NuxtLink to="/admin/articles">Articles</NuxtLink></li>
        <li aria-current="page" class="max-w-xs truncate">{{ article?.title ?? 'Article' }}</li>
      </ul>
    </nav>

    <div v-if="error" role="alert" class="alert alert-error">{{ apiErrorMessage(error) }}</div>

    <template v-if="article">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl font-bold">Modifier l'article</h1>
        <NuxtLink :to="`/articles/${article.id}`" class="btn btn-ghost btn-sm" target="_blank">Voir la fiche publique</NuxtLink>
      </div>

      <div
        v-if="article.type === 'security'"
        class="alert"
        :class="{ 'alert-success': article.alert.state === 'sent', 'alert-error': article.alert.state === 'failed' }"
        role="status"
      >
        <div>
          <p class="font-semibold">{{ alertLabels[article.alert.state] }}</p>
          <p v-if="article.alert.sentAt" class="text-sm">le {{ formatDate(article.alert.sentAt, true) }}</p>
          <p v-if="article.alert.lastError" class="text-sm">{{ article.alert.lastError }}</p>
        </div>
        <button type="button" class="btn btn-sm" :disabled="resending" @click="resendAlert">
          {{ article.alert.state === 'sent' ? 'Renvoyer l\'alerte' : 'Envoyer l\'alerte' }}
        </button>
      </div>

      <p v-if="article.sourceType !== 'manual'" class="text-sm text-base-content/70">
        Article importé automatiquement ({{ article.sourceName }}). Vos modifications sont conservées lors des collectes suivantes
        <template v-if="article.sourceType === 'osv'">, sauf la gravité et les informations CVE, resynchronisées si l'avis OSV est mis à jour</template>.
      </p>

      <AdminArticleForm :key="article.updatedAt" :article="article" />
    </template>
  </div>
</template>
