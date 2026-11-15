<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useSeoMeta({ title: () => (notFound.value ? 'Page introuvable' : 'Erreur'), robots: 'noindex' })
</script>

<template>
  <NuxtLayout>
    <div class="mx-auto max-w-lg py-16 text-center">
      <p class="text-6xl font-bold text-primary">{{ error.statusCode }}</p>
      <h1 class="mt-4 text-2xl font-semibold">
        {{ notFound ? 'Cette page n\'existe pas (ou plus).' : 'Une erreur est survenue.' }}
      </h1>
      <button type="button" class="btn btn-primary mt-8" @click="clearError({ redirect: '/' })">Retour au fil de veille</button>
    </div>
  </NuxtLayout>
</template>
