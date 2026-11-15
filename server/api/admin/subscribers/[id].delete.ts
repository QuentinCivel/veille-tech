export default defineAdminHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) throw createError({ statusCode: 404, statusMessage: 'Destinataire introuvable' })
  await useFirestore().collection(COLLECTIONS.subscribers).doc(id).delete()
  return { ok: true }
})
