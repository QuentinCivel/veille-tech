export default defineAdminHandler(async (event) => {
  const existing = await getArticleById(getRouterParam(event, 'id') ?? '')
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  const input = await readValidatedBody(event, articleInputSchema.parse)
  const id = await saveManualArticle(input, existing)
  // Ex. : un brouillon passe en "publié" ou la gravité passe à "critique" → envoi (une seule fois).
  const alert = input.type === 'security' ? await dispatchSecurityAlert(id, 'manual') : null
  return { id, alert }
})
