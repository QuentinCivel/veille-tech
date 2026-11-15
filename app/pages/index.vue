<script setup lang="ts">
useSeoMeta({
  title: 'Fil de veille',
  description: 'Mises à jour, failles de sécurité, tutoriels et actualités des frameworks et bibliothèques JavaScript suivis.',
  ogTitle: 'Veille Tech — fil de veille technologique',
  ogType: 'website'
})
</script>

<template>
  <div>
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight md:text-4xl">Veille technologique</h1>
      <p class="mt-2 max-w-2xl text-base-content/70">
        Nouvelles versions, failles de sécurité, tutoriels et actualités de chaque technologie de la stack,
        collectés automatiquement depuis GitHub, OSV.dev et les blogs officiels.
      </p>
    </header>

    <CriticalBanner />
    <ArticleFeed />
  </div>
</template>
