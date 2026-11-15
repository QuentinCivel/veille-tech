import { FieldValue } from 'firebase-admin/firestore'

// Ajout d'un destinataire des alertes (réservé aux admins : pas d'inscription publique).
export default defineAdminHandler(async (event) => {
  const input = await readValidatedBody(event, subscriberInputSchema.parse)
  const collection = useFirestore().collection(COLLECTIONS.subscribers)
  const duplicate = await collection.where('email', '==', input.email).limit(1).get()
  if (!duplicate.empty) throw createError({ statusCode: 409, statusMessage: 'Cette adresse est déjà enregistrée' })
  const ref = await collection.add({ ...input, createdAt: FieldValue.serverTimestamp() })
  setResponseStatus(event, 201)
  return { id: ref.id }
})
