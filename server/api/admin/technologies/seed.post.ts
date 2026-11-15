import { DEFAULT_TECHNOLOGIES } from '../../../data/default-technologies'

// Crée les technologies par défaut absentes (n'écrase jamais une technologie existante).
export default defineAdminHandler(async () => {
  const created: string[] = []
  for (const tech of DEFAULT_TECHNOLOGIES) {
    try {
      await saveTechnology(technologyInputSchema.parse(tech), 'create')
      created.push(tech.slug)
    }
    catch (error) {
      if (!isAlreadyExists(error)) throw error
    }
  }
  return { created, skipped: DEFAULT_TECHNOLOGIES.length - created.length }
})
