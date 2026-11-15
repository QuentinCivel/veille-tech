export default defineEventHandler(async (event): Promise<PublicTechnology> => {
  const tech = await getTechnology(getRouterParam(event, 'slug') ?? '')
  // Une technologie privée répond exactement comme une technologie inexistante.
  if (!tech || !tech.tracked || tech.private) throw createError({ statusCode: 404, statusMessage: 'Technologie introuvable' })
  publicCache(event, 300)
  return publicTechnology(tech)
})
