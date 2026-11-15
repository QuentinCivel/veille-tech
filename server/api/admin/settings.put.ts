export default defineAdminHandler(async (event) => {
  const settings = await readValidatedBody(event, alertSettingsSchema.parse)
  await useFirestore().collection(COLLECTIONS.settings).doc('alerts').set(settings)
  return settings
})
