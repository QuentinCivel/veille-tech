export default defineAdminHandler(async (event): Promise<Article> => {
  const article = await getArticleById(getRouterParam(event, 'id') ?? '')
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  return article
})
