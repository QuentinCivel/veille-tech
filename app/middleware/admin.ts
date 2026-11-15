// L'administration n'existe qu'en développement (npm run dev) : ailleurs, page introuvable.
// La vraie protection est côté serveur (server/utils/local-admin.ts) ; ceci évite d'afficher une page inutilisable.
export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Page introuvable', fatal: true })
})
