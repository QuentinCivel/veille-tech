export default defineEventHandler(async (event): Promise<ArticleDetail> => {
  const article = await getArticleById(getRouterParam(event, 'id') ?? '')
  // Article non listé (brouillon, ou rattaché uniquement à des technologies privées) :
  // visible seulement en aperçu depuis l'administration locale, et jamais mis en cache.
  if (!article || (!article.listed && !isLocalAdminRequest(event))) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }
  const { publicSlugs } = await getTechIndex()
  if (article.listed) publicCache(event, 60)
  return { ...publicArticle(article, publicSlugs), contentHtml: renderMarkdown(article.content) }
})
