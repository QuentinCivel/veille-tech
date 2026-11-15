export default defineAdminHandler(async (event) => {
  const article = await getArticleById(getRouterParam(event, 'id') ?? '')
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  await useFirestore().collection(COLLECTIONS.articles).doc(article.id).delete()
  return { ok: true }
})
