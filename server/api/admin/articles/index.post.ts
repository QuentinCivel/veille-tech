export default defineAdminHandler(async (event) => {
  const input = await readValidatedBody(event, articleInputSchema.parse)
  const id = await saveManualArticle(input, null)
  // Une faille critique publiée déclenche immédiatement l'e-mail (la règle d'éligibilité décide).
  const alert = input.type === 'security' ? await dispatchSecurityAlert(id, 'manual') : null
  setResponseStatus(event, 201)
  return { id, alert }
})
