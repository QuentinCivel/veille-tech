<script setup lang="ts">
const route = useRoute()
const links = [
  { to: '/', label: 'Fil de veille' },
  { to: '/technologies', label: 'Technologies' }
]
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
// Lien vers l'administration affiché seulement en développement (elle n'existe pas en production).
const showAdminLink = import.meta.dev
</script>

<template>
  <!-- Fond de page base-200, cartes base-100 : les surfaces se détachent en clair comme en sombre. -->
  <div class="flex min-h-screen flex-col bg-base-200">
    <a href="#contenu" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-primary btn-sm">
      Aller au contenu
    </a>

    <header class="sticky top-0 z-30 border-b border-base-content/10 bg-base-100/90 backdrop-blur">
      <nav class="navbar mx-auto max-w-6xl px-4" aria-label="Navigation principale">
        <div class="flex-1">
          <NuxtLink to="/" class="flex items-center gap-2 text-lg font-bold">
            <span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-content" aria-hidden="true">V</span>
            Veille Tech
          </NuxtLink>
        </div>
        <ul class="menu menu-horizontal gap-1 px-1">
          <li v-for="link in links" :key="link.to">
            <NuxtLink
              :to="link.to"
              :class="{ 'menu-active': isActive(link.to) }"
              :aria-current="isActive(link.to) ? 'page' : undefined"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
        <ThemeToggle />
      </nav>
    </header>

    <main id="contenu" class="mx-auto w-full max-w-6xl flex-1 px-4 py-8" tabindex="-1">
      <slot />
    </main>

    <footer class="footer footer-center border-t border-base-content/10 p-6 text-sm text-base-content/70">
      <p>
        Veille technologique · Sources : GitHub Releases, OSV.dev, blogs officiels
        <template v-if="showAdminLink">· <NuxtLink to="/admin" class="link">Administration (local)</NuxtLink></template>
      </p>
    </footer>
  </div>
</template>
