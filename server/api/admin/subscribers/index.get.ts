export default defineAdminHandler(async (): Promise<Subscriber[]> => {
  const snapshot = await useFirestore().collection(COLLECTIONS.subscribers).orderBy('createdAt', 'asc').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...serializeDoc<Omit<Subscriber, 'id'>>(doc.data()) }))
})
