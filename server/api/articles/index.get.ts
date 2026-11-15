// Fil d'actualités public : uniquement les articles "listés" (publiés et rattachés à une technologie publique),
// sans information sur le projet suivi ni sur les technologies privées.
export default defineEventHandler(async (event): Promise<ArticlePage> => {
  const query = await getValidatedQuery(event, feedQuerySchema.parse)
  const { publicSlugs } = await getTechIndex()

  // Filtrer sur une technologie privée ne doit rien révéler (même pas les articles mixtes).
  const page = query.tech && !publicSlugs.has(query.tech)
    ? { items: [], nextCursor: null }
    : await queryArticles({ ...query, listedOnly: true })

  publicCache(event, 60)
  return { ...page, items: page.items.map(item => publicArticle(item, publicSlugs)) }
})
