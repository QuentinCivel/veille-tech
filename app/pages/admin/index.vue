<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Tableau de bord' })

interface Dashboard {
  counts: { articles: number, drafts: number, critical: number, failedAlerts: number }
  runs: IngestRun[]
  alerts: AlertLog[]
}

const toast = useToast()
const { data, refresh, error } = await useFetch<Dashboard>('/api/admin/dashboard')
const running = ref(false)

async function runIngestion() {
  running.value = true
  try {
    const run = await $fetch<IngestRun>('/api/admin/ingest', { method: 'POST', body: {} })
    toast.success(`Collecte : ${run.technologiesProcessed.length} technologie(s), ${run.created} nouvel(s) article(s), ${run.alertsSent} alerte(s).`)
    if (run.errors) toast.warning(`${run.errors} source(s) en erreur — détail dans l'historique.`)
    await refresh()
  }
  catch (err) {
    toast.error(apiErrorMessage(err))
  }
  finally {
    running.value = false
  }
}

const expandedRun = ref<string | null>(null)
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">Tableau de bord</h1>
      <div class="flex gap-2">
        <NuxtLink to="/admin/articles/new" class="btn btn-outline">Nouvel article</NuxtLink>
        <button type="button" class="btn btn-primary" :disabled="running" @click="runIngestion">
          <span v-if="running" class="loading loading-spinner loading-sm" aria-hidden="true" />
          Lancer une collecte
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">{{ apiErrorMessage(error) }}</div>

    <template v-if="data">
      <div class="stats stats-vertical w-full bg-base-100 shadow sm:stats-horizontal">
        <div class="stat">
          <div class="stat-title">Articles</div>
          <div class="stat-value">{{ data.counts.articles }}</div>
          <div class="stat-desc">dont {{ data.counts.drafts }} brouillon(s)</div>
        </div>
        <div class="stat">
          <div class="stat-title">Failles critiques</div>
          <div class="stat-value text-error">{{ data.counts.critical }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Alertes en échec</div>
          <div class="stat-value" :class="data.counts.failedAlerts ? 'text-warning' : ''">{{ data.counts.failedAlerts }}</div>
          <div class="stat-desc">relancées automatiquement (5 essais)</div>
        </div>
      </div>

      <section class="card bg-base-100 shadow" aria-labelledby="runs-title">
        <div class="card-body">
          <h2 id="runs-title" class="card-title">Dernières collectes</h2>
          <p class="text-sm text-base-content/70">
            Lancées toutes les 30 minutes par Netlify ; chaque passage traite les technologies les moins récemment collectées.
          </p>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr><th>Date</th><th>Origine</th><th>Technologies</th><th>Créés</th><th>Alertes</th><th>Erreurs</th><th><span class="sr-only">Détail</span></th></tr>
              </thead>
              <tbody>
                <template v-for="run in data.runs" :key="run.id">
                  <tr>
                    <td class="whitespace-nowrap">{{ formatDate(run.startedAt, true) }}</td>
                    <td>{{ run.trigger === 'cron' ? 'Automatique' : 'Manuelle' }}</td>
                    <td class="max-w-xs truncate">{{ run.technologiesProcessed.join(', ') }}</td>
                    <td>{{ run.created }}</td>
                    <td>{{ run.alertsSent }}</td>
                    <td><span :class="run.errors ? 'badge badge-warning badge-sm' : ''">{{ run.errors }}</span></td>
                    <td>
                      <button
                        v-if="run.errors"
                        type="button"
                        class="btn btn-ghost btn-xs"
                        :aria-expanded="expandedRun === run.id"
                        @click="expandedRun = expandedRun === run.id ? null : run.id"
                      >
                        Détail
                      </button>
                    </td>
                  </tr>
                  <tr v-if="expandedRun === run.id">
                    <td colspan="7">
                      <ul class="space-y-1 text-xs">
                        <li v-for="(stat, index) in run.stats.filter(s => s.error)" :key="index">
                          <strong>{{ stat.technology }}</strong> ({{ stat.source }}) : {{ stat.error }}
                        </li>
                      </ul>
                    </td>
                  </tr>
                </template>
                <tr v-if="!data.runs.length"><td colspan="7" class="text-center text-base-content/60">Aucune collecte pour l'instant.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card bg-base-100 shadow" aria-labelledby="alerts-title">
        <div class="card-body">
          <h2 id="alerts-title" class="card-title">Dernières alertes e-mail</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr><th>Date</th><th>Article</th><th>Destinataires</th><th>Statut</th></tr>
              </thead>
              <tbody>
                <tr v-for="alert in data.alerts" :key="alert.id">
                  <td class="whitespace-nowrap">{{ formatDate(alert.createdAt, true) }}</td>
                  <td><NuxtLink :to="`/admin/articles/${alert.articleId}`" class="link">{{ alert.articleTitle }}</NuxtLink></td>
                  <td>{{ alert.recipients.length }}</td>
                  <td>
                    <span v-if="alert.status === 'sent'" class="badge badge-success badge-sm">Envoyée</span>
                    <span v-else class="badge badge-error badge-sm" :title="alert.error ?? ''">Échec</span>
                    <span v-if="alert.status === 'failed'" class="ml-2 text-xs text-error">{{ alert.error }}</span>
                  </td>
                </tr>
                <tr v-if="!data.alerts.length"><td colspan="4" class="text-center text-base-content/60">Aucune alerte envoyée.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
