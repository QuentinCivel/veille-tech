<script setup lang="ts">
// Création / modification d'une technologie suivie et de ses sources de collecte.
const props = defineProps<{ technology?: Technology | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const toast = useToast()
const editing = computed(() => Boolean(props.technology))
const t = props.technology

const form = reactive({
  slug: t?.slug ?? '',
  name: t?.name ?? '',
  category: (t?.category ?? 'framework') as TechCategory,
  origin: (t?.origin ?? 'manual') as TechOrigin,
  description: t?.description ?? '',
  website: t?.website ?? '',
  npmPackage: t?.npmPackage ?? '',
  githubRepo: t?.githubRepo ?? '',
  tagPrefix: t?.tagPrefix ?? '',
  releaseMinLevel: (t?.releaseMinLevel ?? 'patch') as ReleaseLevel,
  rssFeeds: (t?.rssFeeds ?? []).map(feed => ({ ...feed })),
  projectVersion: t?.projectVersion ?? '',
  tracked: t?.tracked ?? true,
  private: t?.private ?? false,
  order: t?.order ?? 100
})

// Slug proposé automatiquement à partir du nom (création uniquement).
watch(() => form.name, (name) => {
  if (!editing.value) form.slug = slugify(name, 60)
})

const errors = ref<Record<string, string>>({})
const saving = ref(false)
const levelLabels: Record<ReleaseLevel, string> = { patch: 'Toutes (correctifs inclus)', minor: 'Mineures et majeures', major: 'Majeures uniquement' }

async function submit() {
  const parsed = technologyInputSchema.safeParse({ ...form, order: Number(form.order) })
  errors.value = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.value[issue.path.join('.')] ??= issue.message
    return
  }
  saving.value = true
  try {
    await $fetch(editing.value ? `/api/admin/technologies/${form.slug}` : '/api/admin/technologies', {
      method: editing.value ? 'PUT' : 'POST',
      body: parsed.data
    })
    toast.success(editing.value ? 'Technologie mise à jour.' : 'Technologie ajoutée.')
    emit('saved')
  }
  catch (error) {
    toast.error(apiErrorMessage(error))
  }
  finally {
    saving.value = false
  }
}

const err = (key: string) => errors.value[key]
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <div class="grid gap-x-4 sm:grid-cols-2">
      <fieldset class="fieldset">
        <label class="label" for="tech-name">Nom *</label>
        <input id="tech-name" v-model="form.name" class="input w-full" maxlength="60" :aria-invalid="err('name') ? 'true' : undefined">
        <p v-if="err('name')" class="text-sm text-error">{{ err('name') }}</p>
      </fieldset>
      <fieldset class="fieldset">
        <label class="label" for="tech-slug">Identifiant (slug) *</label>
        <input id="tech-slug" v-model="form.slug" class="input w-full font-mono" :disabled="editing" :aria-invalid="err('slug') ? 'true' : undefined">
        <p v-if="err('slug')" class="text-sm text-error">{{ err('slug') }}</p>
      </fieldset>
      <fieldset class="fieldset">
        <label class="label" for="tech-category">Catégorie</label>
        <select id="tech-category" v-model="form.category" class="select w-full">
          <option v-for="c in TECH_CATEGORIES" :key="c" :value="c">{{ CATEGORY_LABELS[c] }}</option>
        </select>
      </fieldset>
      <fieldset class="fieldset">
        <label class="label" for="tech-origin">Origine</label>
        <select id="tech-origin" v-model="form.origin" class="select w-full">
          <option v-for="(label, key) in ORIGIN_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </fieldset>
    </div>

    <fieldset class="fieldset">
      <label class="label" for="tech-description">Description</label>
      <input id="tech-description" v-model="form.description" class="input w-full" maxlength="300">
      <label class="label" for="tech-website">Site officiel</label>
      <input id="tech-website" v-model="form.website" type="url" class="input w-full" placeholder="https://…">
      <p v-if="err('website')" class="text-sm text-error">{{ err('website') }}</p>
    </fieldset>

    <fieldset class="fieldset rounded-box border border-base-content/10 p-4">
      <legend class="fieldset-legend">Sources de collecte automatique</legend>
      <div class="grid gap-x-4 sm:grid-cols-2">
        <div>
          <label class="label" for="tech-npm">Paquet npm (failles OSV + dernière version)</label>
          <input id="tech-npm" v-model="form.npmPackage" class="input w-full font-mono" placeholder="nuxt">
          <p v-if="err('npmPackage')" class="text-sm text-error">{{ err('npmPackage') }}</p>
        </div>
        <div>
          <label class="label" for="tech-version">Version utilisée par le projet</label>
          <input id="tech-version" v-model="form.projectVersion" class="input w-full font-mono" placeholder="^4.4.8">
        </div>
        <div>
          <label class="label" for="tech-repo">Dépôt GitHub (releases)</label>
          <input id="tech-repo" v-model="form.githubRepo" class="input w-full font-mono" placeholder="owner/repo">
          <p v-if="err('githubRepo')" class="text-sm text-error">{{ err('githubRepo') }}</p>
        </div>
        <div>
          <label class="label" for="tech-prefix">Préfixe des tags (monorepo)</label>
          <input id="tech-prefix" v-model="form.tagPrefix" class="input w-full font-mono" placeholder="firebase@">
        </div>
        <div>
          <label class="label" for="tech-level">Releases importées</label>
          <select id="tech-level" v-model="form.releaseMinLevel" class="select w-full">
            <option v-for="level in RELEASE_LEVELS" :key="level" :value="level">{{ levelLabels[level] }}</option>
          </select>
        </div>
      </div>

      <p class="label mt-3">Flux RSS / Atom</p>
      <ul class="space-y-2">
        <li v-for="(feed, index) in form.rssFeeds" :key="index" class="flex flex-wrap gap-2">
          <label class="input flex-1">
            <span class="sr-only">URL du flux {{ index + 1 }}</span>
            <input v-model="feed.url" type="url" placeholder="https://…/rss.xml">
          </label>
          <label class="select w-44">
            <span class="sr-only">Type par défaut du flux {{ index + 1 }}</span>
            <select v-model="feed.defaultType">
              <option v-for="type in ARTICLE_TYPES" :key="type" :value="type">{{ TYPE_LABELS[type] }}</option>
            </select>
          </label>
          <button type="button" class="btn btn-ghost btn-square" :aria-label="`Retirer le flux ${index + 1}`" @click="form.rssFeeds.splice(index, 1)">✕</button>
        </li>
      </ul>
      <p v-for="(message, key) in errors" v-show="String(key).startsWith('rssFeeds')" :key="key" class="text-sm text-error">{{ message }}</p>
      <button v-if="form.rssFeeds.length < 5" type="button" class="btn btn-ghost btn-sm mt-1 self-start" @click="form.rssFeeds.push({ url: '', defaultType: 'news' })">
        + Ajouter un flux
      </button>
    </fieldset>

    <div class="flex flex-wrap items-center gap-6">
      <label class="label cursor-pointer gap-2 text-base-content">
        <input v-model="form.tracked" type="checkbox" class="toggle toggle-primary"> Suivie (collecte automatique)
      </label>
      <label class="label cursor-pointer gap-2 text-base-content">
        <input v-model="form.private" type="checkbox" class="toggle toggle-warning" aria-describedby="tech-private-help"> Privée
      </label>
      <p id="tech-private-help" class="w-full text-xs text-base-content/60">
        Privée : collectée et visible ici (alertes e-mail comprises), mais absente du site public — ni la technologie,
        ni ses articles n'y apparaissent.
      </p>
      <label class="label gap-2 text-base-content" for="tech-order">
        Ordre
        <input id="tech-order" v-model.number="form.order" type="number" min="0" max="9999" class="input input-sm w-24">
      </label>
    </div>

    <div class="flex justify-end gap-2">
      <button type="button" class="btn btn-ghost" @click="emit('cancel')">Annuler</button>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <span v-if="saving" class="loading loading-spinner loading-sm" aria-hidden="true" />
        Enregistrer
      </button>
    </div>
  </form>
</template>
