// Les articles déjà collectés sont conservés, mais ceux qui ne sont rattachés à aucune autre technologie
// publique disparaissent du site public (un slug inconnu ne compte pas comme public).
export default defineAdminHandler(async (event) => {
  const tech = await getTechnology(getRouterParam(event, 'slug') ?? '')
  if (!tech) throw createError({ statusCode: 404, statusMessage: 'Technologie introuvable' })
  await useFirestore().collection(COLLECTIONS.technologies).doc(tech.slug).delete()
  invalidateTechIndex()
  const articlesUpdated = await refreshListing(tech.slug)
  return { ok: true, articlesUpdated }
})
