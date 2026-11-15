<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Technologies' })

type Proposal = TechnologyInput & { dependencyType: string, exists: boolean }

const toast = useToast()
const { data: technologies, refresh } = await useFetch<Technology[]>('/api/admin/technologies', { key: 'admin-technologies', default: () => [] })

// ---- Modale d'édition (balise <dialog> native : focus piégé et touche Échap gérés par le navigateur)
const editDialog = ref<HTMLDialogElement>()
const editing = ref<Technology | null>(null)
const formKey = ref(0)
function openForm(tech: Technology | null) {
  editing.value = tech
  formKey.value++
  editDialog.value?.showModal()
}
async function onSaved() {
  editDialog.value?.close()
  await refresh()
}

// ---- Actions
const busy = ref<string | null>(null)

async function seed() {
  busy.value = 'seed'
  try {
    const result = await $fetch<{ created: string[], skipped: number }>('/api/admin/technologies/seed', { method: 'POST' })
    toast.success(`${result.created.length} technologie(s) ajoutée(s), ${result.skipped} déjà présente(s).`)
    await refresh()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    busy.value = null
  }
}

async function collect(tech: Technology) {
  busy.value = tech.slug
  try {
    const run = await $fetch<IngestRun>('/api/admin/ingest', { method: 'POST', body: { only: tech.slug } })
    const errors = run.stats.filter(stat => stat.error)
    if (errors.length) toast.warning(`${tech.name} : ${errors.map(e => `${e.source} — ${e.error}`).join(' ; ')}`)
    toast.success(`${tech.name} : ${run.created} nouvel(s) article(s), ${run.updated} mis à jour.`)
    await refresh()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    busy.value = null
  }
}

/** Bascule un réglage booléen (suivi / privée) sans ouvrir le formulaire. */
async function toggle(tech: Technology, field: 'tracked' | 'private') {
  try {
    const { lastIngestAt: _a, lastIngestError: _b, latestVersion: _c, createdAt: _d, updatedAt: _e, ...input } = tech
    const result = await $fetch<{ articlesUpdated: number }>(`/api/admin/technologies/${tech.slug}`, {
      method: 'PUT',
      body: { ...input, [field]: !tech[field] }
    })
    if (field === 'private') {
      toast.success(`${tech.name} est maintenant ${tech.private ? 'publique' : 'privée'} (${result.articlesUpdated} article(s) ${tech.private ? 'affiché(s)' : 'masqué(s)'} sur le site public).`)
    }
    await refresh()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
}

async function remove(tech: Technology) {
  if (!confirm(`Supprimer « ${tech.name} » ? Les articles déjà collectés sont conservés.`)) return
  try {
    await $fetch(`/api/admin/technologies/${tech.slug}`, { method: 'DELETE' })
    toast.success('Technologie supprimée.')
    await refresh()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
}

// ---- Import d'un package.json
const importDialog = ref<HTMLDialogElement>()
const packageJson = ref('')
const proposals = ref<Proposal[]>([])
const selected = ref<string[]>([])

async function analyze() {
  busy.value = 'analyze'
  try {
    proposals.value = await $fetch<Proposal[]>('/api/admin/technologies/analyze', { method: 'POST', body: { packageJson: packageJson.value } })
    selected.value = proposals.value.filter(p => !p.exists).map(p => p.slug)
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    busy.value = null
  }
}

async function importSelected() {
  busy.value = 'import'
  let created = 0
  for (const proposal of proposals.value.filter(p => selected.value.includes(p.slug))) {
    const { dependencyType: _type, exists: _exists, ...input } = proposal
    try {
      await $fetch('/api/admin/technologies', { method: 'POST', body: input })
      created++
    }
    catch (error) {
      toast.error(`${proposal.name} : ${apiErrorMessage(error)}`)
    }
  }
  busy.value = null
  toast.success(`${created} technologie(s) importée(s).`)
  importDialog.value?.close()
  proposals.value = []
  packageJson.value = ''
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">Technologies suivies</h1>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-outline btn-sm" :disabled="busy === 'seed'" @click="seed">Initialiser les technologies par défaut</button>
        <button type="button" class="btn btn-outline btn-sm" @click="importDialog?.showModal()">Importer un package.json</button>
        <button type="button" class="btn btn-primary btn-sm" @click="openForm(null)">Ajouter</button>
      </div>
    </div>

    <div v-if="!technologies?.length" class="alert alert-info">
      Aucune technologie. Cliquez sur « Initialiser les technologies par défaut » pour charger la liste de départ.
    </div>

    <div v-else class="overflow-x-auto rounded-box bg-base-100 shadow">
      <table class="table table-sm">
        <thead>
          <tr><th>Technologie</th><th>Sources</th><th>Versions</th><th>Dernière collecte</th><th>Suivie</th><th>Privée</th><th><span class="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="tech in technologies" :key="tech.slug" :class="{ 'opacity-60': !tech.tracked }">
            <td>
              <p class="font-medium">
                {{ tech.name }}
                <span v-if="tech.private" class="badge badge-warning badge-soft badge-xs ml-1" title="Absente du site public">Privée</span>
              </p>
              <p class="text-xs text-base-content/60">{{ CATEGORY_LABELS[tech.category] }} · {{ ORIGIN_LABELS[tech.origin] }}</p>
            </td>
            <td>
              <div class="flex flex-wrap gap-1">
                <span v-if="tech.githubRepo" class="badge badge-ghost badge-xs" :title="tech.githubRepo">GitHub</span>
                <span v-if="tech.npmPackage" class="badge badge-ghost badge-xs" :title="tech.npmPackage">OSV</span>
                <span v-if="tech.rssFeeds.length" class="badge badge-ghost badge-xs">RSS × {{ tech.rssFeeds.length }}</span>
                <span v-if="!tech.githubRepo && !tech.npmPackage && !tech.rssFeeds.length" class="text-xs text-base-content/60">Manuelle</span>
              </div>
            </td>
            <td><VersionStatus :tech="tech" /></td>
            <td class="text-xs">
              <span v-if="tech.lastIngestAt">{{ formatDate(tech.lastIngestAt, true) }}</span>
              <span v-else class="text-base-content/60">Jamais</span>
              <p v-if="tech.lastIngestError" class="max-w-xs text-error">{{ tech.lastIngestError }}</p>
            </td>
            <td>
              <input type="checkbox" class="toggle toggle-sm toggle-primary" :checked="tech.tracked" :aria-label="`Suivre ${tech.name}`" @change="toggle(tech, 'tracked')">
            </td>
            <td>
              <input type="checkbox" class="toggle toggle-sm toggle-warning" :checked="tech.private" :aria-label="`Rendre ${tech.name} privée (masquée du site public)`" @change="toggle(tech, 'private')">
            </td>
            <td class="whitespace-nowrap">
              <button type="button" class="btn btn-ghost btn-xs" :disabled="busy === tech.slug || !tech.tracked" @click="collect(tech)">
                <span v-if="busy === tech.slug" class="loading loading-spinner loading-xs" aria-hidden="true" />
                Collecter<span class="sr-only"> {{ tech.name }}</span>
              </button>
              <button type="button" class="btn btn-ghost btn-xs" @click="openForm(tech)">Modifier<span class="sr-only"> {{ tech.name }}</span></button>
              <button type="button" class="btn btn-ghost btn-xs text-error" @click="remove(tech)">Supprimer<span class="sr-only"> {{ tech.name }}</span></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <dialog ref="editDialog" class="modal" aria-labelledby="edit-title">
      <div class="modal-box max-w-3xl">
        <h2 id="edit-title" class="mb-4 text-lg font-bold">{{ editing ? `Modifier ${editing.name}` : 'Ajouter une technologie' }}</h2>
        <AdminTechnologyForm :key="formKey" :technology="editing" @saved="onSaved" @cancel="editDialog?.close()" />
      </div>
      <form method="dialog" class="modal-backdrop"><button>Fermer</button></form>
    </dialog>

    <dialog ref="importDialog" class="modal" aria-labelledby="import-title">
      <div class="modal-box max-w-4xl">
        <h2 id="import-title" class="text-lg font-bold">Importer un package.json</h2>
        <p class="mb-4 text-sm text-base-content/70">
          Chaque dépendance est analysée (registre npm) et devient une proposition de technologie à suivre.
          Les paquets <code>@types/*</code> sont ignorés.
        </p>

        <template v-if="!proposals.length">
          <label class="sr-only" for="package-json">Contenu du package.json</label>
          <textarea id="package-json" v-model="packageJson" class="textarea w-full font-mono text-xs" rows="14" placeholder="{ &quot;dependencies&quot;: { … } }" />
          <div class="modal-action">
            <form method="dialog"><button class="btn btn-ghost">Annuler</button></form>
            <button type="button" class="btn btn-primary" :disabled="!packageJson.trim() || busy === 'analyze'" @click="analyze">
              <span v-if="busy === 'analyze'" class="loading loading-spinner loading-sm" aria-hidden="true" />
              Analyser
            </button>
          </div>
        </template>

        <template v-else>
          <div class="max-h-[60vh] overflow-auto">
            <table class="table table-sm">
              <thead><tr><th><span class="sr-only">Importer</span></th><th>Paquet</th><th>Version</th><th>Catégorie</th><th>Dépôt GitHub</th></tr></thead>
              <tbody>
                <tr v-for="proposal in proposals" :key="proposal.slug">
                  <td>
                    <input v-model="selected" type="checkbox" class="checkbox checkbox-sm" :value="proposal.slug" :disabled="proposal.exists" :aria-label="`Importer ${proposal.name}`">
                  </td>
                  <td>
                    {{ proposal.name }}
                    <span v-if="proposal.exists" class="badge badge-ghost badge-xs">déjà suivie</span>
                    <p class="text-xs text-base-content/60">{{ proposal.dependencyType }}</p>
                  </td>
                  <td class="font-mono text-xs">{{ proposal.projectVersion }}</td>
                  <td>{{ CATEGORY_LABELS[proposal.category] }}</td>
                  <td class="font-mono text-xs">{{ proposal.githubRepo || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="proposals = []">← Modifier le JSON</button>
            <button type="button" class="btn btn-primary" :disabled="!selected.length || busy === 'import'" @click="importSelected">
              Importer {{ selected.length }} technologie(s)
            </button>
          </div>
        </template>
      </div>
      <form method="dialog" class="modal-backdrop"><button>Fermer</button></form>
    </dialog>
  </div>
</template>
