<script setup lang="ts">
// Thème choisi par l'utilisateur, lu dès le rendu serveur (cookie) pour éviter un flash de couleurs.
const theme = useCookie<'light' | 'dark' | null>('theme', { default: () => null, sameSite: 'lax' })

useHead({
  htmlAttrs: { 'data-theme': () => theme.value ?? undefined }
})
</script>

<template>
  <NuxtLoadingIndicator color="var(--color-primary)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
