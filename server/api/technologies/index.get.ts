// Technologies affichées sur le site public : suivies et non privées.
export default defineEventHandler(async (event): Promise<PublicTechnology[]> => {
  const technologies = await listTechnologies()
  publicCache(event, 300)
  return technologies.filter(tech => tech.tracked && !tech.private).map(publicTechnology)
})
