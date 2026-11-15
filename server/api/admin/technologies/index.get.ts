// Liste complète (y compris les technologies non suivies) avec l'état de la dernière collecte.
export default defineAdminHandler(async () => {
  const technologies = await listTechnologies()
  return technologies.map(adminTechnology)
})
