<script setup lang="ts">
// Formulaire de création / modification d'un article (saisie manuelle de la veille).
// Validation locale avec le même schéma zod que le serveur (shared/utils/schemas.ts).
const props = defineProps<{ article?: Article | null }>()

const toast = useToast()
const { data: technologies } = useFetch<Technology[]>('/api/admin/technologies', { key: 'admin-technologies', default: () => [] })

/** ISO -> valeur d'un <input type="datetime-local"> (heure locale). */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const source = props.article
const form = reactive({
  title: source?.title ?? '',
  summary: source?.summary ?? '',
  content: source?.content ?? '',
  url: source?.url ?? '',
  sourceName: source?.sourceName ?? '',
  type: (source?.type ?? 'news') as ArticleType,
  severity: (source?.severity ?? '') as Severity | '',
  technologies: [...(source?.technologies ?? [])],
  tags: (source?.tags ?? []).join(', '),
  version: source?.version ?? '',
  cveIds: (source?.cve?.ids ?? []).join(', '),
  cvss: source?.cve?.cvss != null ? String(source.cve.cvss) : '',
  status: (source?.status ?? 'published') as ArticleStatus,
  publishedAt: toLocalInput(source?.publishedAt ?? new Date().toISOString())
})

const errors = ref<Record<string, string>>({})
const saving = ref(false)
const isSecurity = computed(() => form.type === 'security')
const willAlert = computed(() => isSecurity.value && form.severity === 'critical' && form.status === 'published')

const splitList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)

function payload() {
  return {
    title: form.title,
    summary: form.summary,
    content: form.content,
    url: form.url.trim(),
    sourceName: form.sourceName,
    type: form.type,
    severity: isSecurity.value && form.severity ? form.severity : null,
    technologies: form.technologies,
    tags: splitList(form.tags),
    version: form.version.trim() || null,
    cveIds: isSecurity.value ? splitList(form.cveIds) : [],
    cvss: isSecurity.value && form.cvss !== '' ? Number(form.cvss) : null,
    status: form.status,
    publishedAt: new Date(form.publishedAt).toISOString()
  }
}

async function submit() {
  const body = payload()
  const parsed = articleInputSchema.safeParse(body)
  errors.value = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      errors.value[key] ??= issue.message
    }
    await nextTick()
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }

  saving.value = true
  try {
    const result = await $fetch<{ id: string, alert: Parameters<typeof describeDispatch>[0] }>(
      props.article ? `/api/admin/articles/${props.article.id}` : '/api/admin/articles',
      { method: props.article ? 'PUT' : 'POST', body: parsed.data }
    )
    toast.success(props.article ? 'Article mis à jour.' : 'Article créé.')
    const alertInfo = describeDispatch(result.alert)
    if (alertInfo) toast[alertInfo.type](alertInfo.message)
    if (!props.article) await navigateTo(`/admin/articles/${result.id}`)
    else await refreshNuxtData()
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    saving.value = false
  }
}

const fieldAttrs = (name: string) => ({
  'aria-invalid': errors.value[name] ? ('true' as const) : undefined,
  'aria-describedby': errors.value[name] ? `${name}-error` : undefined
})
</script>

<template>
  <form class="grid gap-6 lg:grid-cols-3" novalidate @submit.prevent="submit">
    <div class="space-y-4 lg:col-span-2">
      <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-100 p-4">
        <legend class="fieldset-legend">Contenu</legend>

        <label class="label" for="title">Titre *</label>
        <input id="title" v-model="form.title" class="input w-full" maxlength="200" required v-bind="fieldAttrs('title')">
        <p v-if="errors.title" id="title-error" class="text-sm text-error">{{ errors.title }}</p>

        <label class="label" for="summary">Résumé (affiché dans le fil et les e-mails)</label>
        <textarea id="summary" v-model="form.summary" class="textarea w-full" rows="3" maxlength="600" v-bind="fieldAttrs('summary')" />
        <p class="label text-xs">{{ form.summary.length }} / 600</p>

        <label class="label" for="content">Contenu détaillé (Markdown)</label>
        <textarea id="content" v-model="form.content" class="textarea w-full font-mono text-sm" rows="14" v-bind="fieldAttrs('content')" />

        <label class="label" for="url">Lien vers la source</label>
        <input id="url" v-model="form.url" type="url" class="input w-full" placeholder="https://…" v-bind="fieldAttrs('url')">
        <p v-if="errors.url" id="url-error" class="text-sm text-error">{{ errors.url }}</p>

        <label class="label" for="sourceName">Nom de la source</label>
        <input id="sourceName" v-model="form.sourceName" class="input w-full" maxlength="120" placeholder="Blog officiel, GitHub…">
      </fieldset>

      <fieldset v-if="isSecurity" class="fieldset rounded-box border-2 border-error/50 bg-error/5 p-4">
        <legend class="fieldset-legend text-error">Faille de sécurité</legend>

        <label class="label" for="severity">Gravité *</label>
        <select id="severity" v-model="form.severity" class="select w-full" v-bind="fieldAttrs('severity')">
          <option value="">Non évaluée</option>
          <option v-for="s in SEVERITIES" :key="s" :value="s">{{ SEVERITY_LABELS[s] }}</option>
        </select>

        <label class="label" for="cveIds">Identifiants CVE / GHSA (séparés par des virgules)</label>
        <input id="cveIds" v-model="form.cveIds" class="input w-full font-mono" placeholder="CVE-2026-12345, GHSA-xxxx-xxxx-xxxx" v-bind="fieldAttrs('cveIds')">
        <p v-if="errors.cveIds" id="cveIds-error" class="text-sm text-error">{{ errors.cveIds }}</p>

        <label class="label" for="cvss">Score CVSS (0 à 10)</label>
        <input id="cvss" v-model="form.cvss" type="number" min="0" max="10" step="0.1" class="input w-32" v-bind="fieldAttrs('cvss')">

        <div v-if="willAlert" role="note" class="alert alert-error alert-soft mt-2 text-sm">
          L'enregistrement de cet article publié et classé « Critique » enverra immédiatement une alerte e-mail aux administrateurs
          (une seule fois par article).
        </div>
      </fieldset>
    </div>

    <div class="space-y-4">
      <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-100 p-4">
        <legend class="fieldset-legend">Classement</legend>

        <label class="label" for="type">Type *</label>
        <select id="type" v-model="form.type" class="select w-full">
          <option v-for="t in ARTICLE_TYPES" :key="t" :value="t">{{ TYPE_LABELS[t] }}</option>
        </select>

        <p class="label mt-2" id="techs-label">Technologies * </p>
        <div class="max-h-60 space-y-1 overflow-y-auto rounded-box border border-base-content/10 p-2" role="group" aria-labelledby="techs-label" v-bind="fieldAttrs('technologies')" tabindex="-1">
          <label v-for="tech in technologies" :key="tech.slug" class="label cursor-pointer justify-start gap-2 text-base-content">
            <input v-model="form.technologies" type="checkbox" class="checkbox checkbox-sm" :value="tech.slug">
            {{ tech.name }}
          </label>
        </div>
        <p v-if="errors.technologies" id="technologies-error" class="text-sm text-error">{{ errors.technologies }}</p>

        <label class="label" for="tags">Tags (séparés par des virgules)</label>
        <input id="tags" v-model="form.tags" class="input w-full" placeholder="ssr, performance">

        <label class="label" for="version">Version concernée</label>
        <input id="version" v-model="form.version" class="input w-full font-mono" placeholder="v4.6.1" maxlength="60">
      </fieldset>

      <fieldset class="fieldset rounded-box border border-base-content/10 bg-base-100 p-4">
        <legend class="fieldset-legend">Publication</legend>
        <div class="flex gap-4" role="radiogroup" aria-label="Statut">
          <label class="label cursor-pointer gap-2 text-base-content">
            <input v-model="form.status" type="radio" class="radio radio-sm" value="published"> Publié
          </label>
          <label class="label cursor-pointer gap-2 text-base-content">
            <input v-model="form.status" type="radio" class="radio radio-sm" value="draft"> Brouillon
          </label>
        </div>
        <label class="label" for="publishedAt">Date de publication</label>
        <input id="publishedAt" v-model="form.publishedAt" type="datetime-local" class="input w-full">
      </fieldset>

      <button type="submit" class="btn btn-primary w-full" :disabled="saving">
        <span v-if="saving" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ article ? 'Enregistrer les modifications' : 'Créer l\'article' }}
      </button>
    </div>
  </form>
</template>
