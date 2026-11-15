<script setup lang="ts">
useSeoMeta({
  title: 'Technologies suivies',
  description: 'Technologies suivies par la veille : dernières versions, failles de sécurité et actualités.'
})

const { technologies, status } = useTechnologies()

// Regroupement par catégorie, dans l'ordre défini par TECH_CATEGORIES.
const groups = computed(() => TECH_CATEGORIES
  .map(category => ({ category, items: (technologies.value ?? []).filter(tech => tech.category === category) }))
  .filter(group => group.items.length))
</script>

<template>
  <div>
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">Technologies suivies</h1>
      <p class="mt-2 max-w-2xl text-base-content/70">
        Frameworks, bibliothèques et services suivis par la veille, avec leur dernière version publiée.
      </p>
    </header>

    <div v-if="status === 'pending' && !technologies?.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="skeleton h-40" />
    </div>

    <p v-else-if="!groups.length" class="rounded-box border border-dashed border-base-content/20 p-10 text-center">
      Aucune technologie n'est encore suivie.
    </p>

    <section v-for="group in groups" :key="group.category" class="mb-10" :aria-labelledby="`cat-${group.category}`">
      <h2 :id="`cat-${group.category}`" class="mb-4 text-xl font-semibold">{{ CATEGORY_LABELS[group.category] }}</h2>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="tech in group.items" :key="tech.slug" class="flex min-w-0 [&>*]:w-full">
          <article class="card relative min-w-0 border [overflow-wrap:anywhere] border-base-content/10 bg-base-100 shadow-sm transition-shadow hover:shadow-md">
            <div class="card-body gap-3 p-5">
              <h3 class="card-title">
                <NuxtLink :to="`/technologies/${tech.slug}`" class="after:absolute after:inset-0 hover:underline">{{ tech.name }}</NuxtLink>
              </h3>
              <p class="line-clamp-2 max-h-[2lh] text-sm text-base-content/70">{{ tech.description }}</p>
              <VersionStatus :tech="tech" />
            </div>
          </article>
        </li>
      </ul>
    </section>
  </div>
</template>
