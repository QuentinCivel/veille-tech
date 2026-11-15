export default defineAdminHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw createError({ statusCode: 404, statusMessage: 'Destinataire introuvable' })
  const input = await readValidatedBody(event, subscriberInputSchema.parse)
  const ref = useFirestore().collection(COLLECTIONS.subscribers).doc(id)
  if (!(await ref.get()).exists) throw createError({ statusCode: 404, statusMessage: 'Destinataire introuvable' })
  await ref.update(input)
  return { id }
})
