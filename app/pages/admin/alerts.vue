<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Alertes e-mail' })

const toast = useToast()
const { data: technologies } = await useFetch<Technology[]>('/api/admin/technologies', { key: 'admin-technologies', default: () => [] })
const { data: settings } = await useFetch<AlertSettings>('/api/admin/settings')
const { data: subscribers, refresh: refreshSubscribers } = await useFetch<Subscriber[]>('/api/admin/subscribers', { default: () => [] })

// ---- Réglages
const savingSettings = ref(false)
async function saveSettings() {
  if (!settings.value) return
  savingSettings.value = true
  try {
    settings.value = await $fetch<AlertSettings>('/api/admin/settings', { method: 'PUT', body: { ...settings.value, maxAgeDays: Number(settings.value.maxAgeDays) } })
    toast.success('Réglages enregistrés.')
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    savingSettings.value = false
  }
}

// ---- Destinataires
const newSubscriber = reactive({ email: '', name: '', technologies: [] as string[] })
async function addSubscriber() {
  const parsed = subscriberInputSchema.safeParse({ ...newSubscriber, active: true })
  if (!parsed.success) {
    toast.error(parsed.error.issues[0]?.message ?? 'Saisie invalide')
    return
  }
  try {
    await $fetch('/api/admin/subscribers', { method: 'POST', body: parsed.data })
    Object.assign(newSubscriber, { email: '', name: '', technologies: [] })
    toast.success('Destinataire ajouté.')
    await refreshSubscribers()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
}

async function updateSubscriber(subscriber: Subscriber, patch: Partial<Subscriber>) {
  try {
    const { id: _id, createdAt: _createdAt, ...input } = { ...subscriber, ...patch }
    await $fetch(`/api/admin/subscribers/${subscriber.id}`, { method: 'PUT', body: input })
    await refreshSubscribers()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
}

async function removeSubscriber(subscriber: Subscriber) {
  if (!confirm(`Retirer ${subscriber.email} des destinataires ?`)) return
  try {
    await $fetch(`/api/admin/subscribers/${subscriber.id}`, { method: 'DELETE' })
    await refreshSubscribers()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
}

// ---- E-mail de test
const testEmail = ref('')
const sendingTest = ref(false)
async function sendTest() {
  sendingTest.value = true
  try {
    await $fetch('/api/admin/subscribers/test', { method: 'POST', body: { email: testEmail.value.trim() } })
    toast.success(`E-mail de test envoyé à ${testEmail.value}.`)
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    sendingTest.value = false
  }
}

const techName = (slug: string) => technologies.value?.find(t => t.slug === slug)?.name ?? slug
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-bold">Alertes e-mail de sécurité</h1>

    <section v-if="settings" class="card bg-base-100 shadow" aria-labelledby="settings-title">
      <form class="card-body" @submit.prevent="saveSettings">
        <h2 id="settings-title" class="card-title">Règles de déclenchement</h2>
        <p class="text-sm text-base-content/70">
          Un e-mail part immédiatement (une seule fois par article) dès qu'un article de sécurité publié atteint le seuil de gravité,
          qu'il soit saisi dans l'admin ou importé par la collecte automatique.
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="label cursor-pointer justify-start gap-3 text-base-content">
            <input v-model="settings.enabled" type="checkbox" class="toggle toggle-primary">
            Alertes activées
          </label>
          <label class="flex items-center gap-3">
            <span>Gravité minimale</span>
            <select v-model="settings.minSeverity" class="select select-sm w-40">
              <option v-for="s in SEVERITIES" :key="s" :value="s">{{ SEVERITY_LABELS[s] }}</option>
            </select>
          </label>
          <label class="label cursor-pointer justify-start gap-3 text-base-content">
            <input v-model="settings.onlyAffectingProject" type="checkbox" class="toggle toggle-primary">
            Failles importées : seulement si la version du projet est concernée
          </label>
          <label class="flex items-center gap-3">
            <span>Ignorer les failles importées publiées il y a plus de</span>
            <input v-model.number="settings.maxAgeDays" type="number" min="1" max="365" class="input input-sm w-20">
            <span>jours</span>
          </label>
        </div>
        <div class="card-actions justify-end">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="savingSettings">Enregistrer</button>
        </div>
      </form>
    </section>

    <section class="card bg-base-100 shadow" aria-labelledby="subscribers-title">
      <div class="card-body">
        <h2 id="subscribers-title" class="card-title">Destinataires (administrateurs)</h2>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead><tr><th>E-mail</th><th>Nom</th><th>Technologies</th><th>Actif</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              <tr v-for="subscriber in subscribers" :key="subscriber.id">
                <td>{{ subscriber.email }}</td>
                <td>{{ subscriber.name }}</td>
                <td class="text-sm">{{ subscriber.technologies.length ? subscriber.technologies.map(techName).join(', ') : 'Toutes' }}</td>
                <td>
                  <input type="checkbox" class="toggle toggle-sm toggle-success" :checked="subscriber.active" :aria-label="`Activer ${subscriber.email}`" @change="updateSubscriber(subscriber, { active: !subscriber.active })">
                </td>
                <td><button type="button" class="btn btn-ghost btn-xs text-error" @click="removeSubscriber(subscriber)">Retirer<span class="sr-only"> {{ subscriber.email }}</span></button></td>
              </tr>
              <tr v-if="!subscribers?.length"><td colspan="5" class="text-center text-warning">Aucun destinataire : les alertes ne peuvent pas être envoyées.</td></tr>
            </tbody>
          </table>
        </div>

        <form class="mt-4 grid gap-3 rounded-box border border-base-content/10 p-4 md:grid-cols-[1fr_1fr_auto]" @submit.prevent="addSubscriber">
          <h3 class="font-semibold md:col-span-3">Ajouter un destinataire</h3>
          <label class="input w-full">
            <span class="sr-only">E-mail</span>
            <input v-model="newSubscriber.email" type="email" placeholder="admin@exemple.fr" required autocomplete="email">
          </label>
          <label class="input w-full">
            <span class="sr-only">Nom</span>
            <input v-model="newSubscriber.name" placeholder="Nom (facultatif)">
          </label>
          <button type="submit" class="btn btn-primary">Ajouter</button>
          <details class="md:col-span-3">
            <summary class="cursor-pointer text-sm">Limiter à certaines technologies (par défaut : toutes)</summary>
            <div class="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
              <label v-for="tech in technologies" :key="tech.slug" class="label cursor-pointer justify-start gap-2 text-base-content">
                <input v-model="newSubscriber.technologies" type="checkbox" class="checkbox checkbox-xs" :value="tech.slug">
                {{ tech.name }}
              </label>
            </div>
          </details>
        </form>
      </div>
    </section>

    <section class="card bg-base-100 shadow" aria-labelledby="test-title">
      <form class="card-body" @submit.prevent="sendTest">
        <h2 id="test-title" class="card-title">Tester l'envoi (Resend)</h2>
        <div class="flex flex-wrap gap-2">
          <label class="input flex-1">
            <span class="sr-only">Adresse de test</span>
            <input v-model="testEmail" type="email" required placeholder="vous@exemple.fr">
          </label>
          <button type="submit" class="btn btn-outline" :disabled="sendingTest || !testEmail">
            <span v-if="sendingTest" class="loading loading-spinner loading-sm" aria-hidden="true" />
            Envoyer un e-mail de test
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
