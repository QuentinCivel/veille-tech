// Renvoi manuel de l'alerte (même si elle a déjà été envoyée).
export default defineAdminHandler(async (event) => {
  const article = await getArticleById(getRouterParam(event, 'id') ?? '')
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  return dispatchSecurityAlert(article.id, 'manual', { force: true })
})
