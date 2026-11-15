// Recalcule la visibilité publique ("listed") de tous les articles.
// Utile après une migration ou une modification directe dans la console Firebase.
export default defineAdminHandler(async () => {
  const articlesUpdated = await refreshListing()
  return { articlesUpdated }
})
