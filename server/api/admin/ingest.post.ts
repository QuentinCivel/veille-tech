import { z } from 'zod'

// Collecte lancée à la main depuis le tableau de bord (éventuellement pour une seule technologie).
const bodySchema = z.object({ only: z.string().regex(/^[a-z0-9-]{1,60}$/).optional() })

export default defineAdminHandler(async (event) => {
  const body = await readValidatedBody(event, value => bodySchema.parse(value ?? {}))
  return runIngestion('admin', { only: body.only })
})
