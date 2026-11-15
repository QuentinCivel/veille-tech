<script setup lang="ts">
const route = useRoute()
const { toasts, dismiss } = useToast()

const links = [
  { to: '/admin', label: 'Tableau de bord', exact: true },
  { to: '/admin/articles', label: 'Articles' },
  { to: '/admin/technologies', label: 'Technologies' },
  { to: '/admin/alerts', label: 'Alertes e-mail' }
]
const isActive = (link: { to: string, exact?: boolean }) => (link.exact ? route.path === link.to : route.path.startsWith(link.to))
const toastClass = { success: 'alert-success', error: 'alert-error', info: 'alert-info', warning: 'alert-warning' }
</script>

<template>
  <div class="drawer lg:drawer-open">
    <input id="admin-drawer" type="checkbox" class="drawer-toggle" aria-label="Ouvrir le menu d'administration">
    <div class="drawer-content flex min-h-screen flex-col bg-base-200">
      <header class="navbar border-b border-base-content/10 bg-base-100 px-4">
        <label for="admin-drawer" class="btn btn-ghost btn-square lg:hidden" aria-label="Menu">
          <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </label>
        <p class="flex-1 font-semibold">Administration</p>
        <span class="badge badge-warning badge-soft mr-2" title="L'administration n'existe pas sur le site en ligne">Mode local</span>
        <ThemeToggle />
      </header>
      <main id="contenu" class="flex-1 p-4 md:p-8">
        <slot />
      </main>
    </div>

    <div class="drawer-side z-40">
      <label for="admin-drawer" class="drawer-overlay" aria-label="Fermer le menu" />
      <nav class="flex min-h-full w-64 flex-col border-r border-base-content/10 bg-base-100 p-4" aria-label="Administration">
        <NuxtLink to="/" class="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-content" aria-hidden="true">V</span>
          Veille Tech
        </NuxtLink>
        <ul class="menu w-full gap-1 p-0">
          <li v-for="link in links" :key="link.to">
            <NuxtLink :to="link.to" :class="{ 'menu-active': isActive(link) }" :aria-current="isActive(link) ? 'page' : undefined">
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
        <NuxtLink to="/" class="btn btn-ghost btn-sm mt-auto justify-start">← Voir le site public</NuxtLink>
      </nav>
    </div>

    <div class="toast toast-end z-50" aria-live="polite" role="status">
      <div v-for="toast in toasts" :key="toast.id" class="alert max-w-sm" :class="toastClass[toast.type]">
        <span>{{ toast.message }}</span>
        <button type="button" class="btn btn-ghost btn-xs" aria-label="Fermer la notification" @click="dismiss(toast.id)">✕</button>
      </div>
    </div>
  </div>
</template>
