export default defineAdminHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const existing = await getTechnology(slug)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Technologie introuvable' })
  const input = await readValidatedBody(event, technologyInputSchema.parse)
  if (input.slug !== slug) throw createError({ statusCode: 400, statusMessage: 'Le slug ne peut pas être modifié' })
  await saveTechnology(input, 'update')

  // Changement de visibilité : on recalcule immédiatement quels articles apparaissent sur le site public.
  const articlesUpdated = existing.private !== input.private ? await refreshListing(slug) : 0
  return { slug, articlesUpdated }
})
