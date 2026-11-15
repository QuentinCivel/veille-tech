<script setup lang="ts">
const theme = useCookie<'light' | 'dark' | null>('theme', { default: () => null, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })

// Sans choix explicite, on suit la préférence du système. Elle n'est lue qu'après le montage :
// le serveur ne la connaît pas, et lire matchMedia plus tôt rendrait un HTML différent (erreur d'hydratation).
const systemDark = ref(false)
onMounted(() => {
  systemDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
})
const isDark = computed(() => (theme.value ? theme.value === 'dark' : systemDark.value))

function toggle() {
  theme.value = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <button
    type="button"
    class="btn btn-ghost btn-circle"
    :aria-label="isDark ? 'Passer au thème clair' : 'Passer au thème sombre'"
    :title="isDark ? 'Thème clair' : 'Thème sombre'"
    @click="toggle"
  >
    <ClientOnly>
      <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <template #fallback>
        <span class="size-5" aria-hidden="true" />
      </template>
    </ClientOnly>
  </button>
</template>
