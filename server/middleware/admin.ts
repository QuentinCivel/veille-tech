// Point de contrôle unique : toute route /api/admin/** n'est servie qu'en développement, en local.
export default defineEventHandler((event) => {
  if (event.path.toLowerCase().startsWith('/api/admin')) requireLocalAdmin(event)
})
