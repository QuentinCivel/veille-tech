import { z } from 'zod'

// E-mail de test pour valider la configuration Resend (clé API, domaine expéditeur).
export default defineAdminHandler(async (event) => {
  const { email } = await readValidatedBody(event, z.object({ email: z.email().max(254) }).parse)
  try {
    await sendTestEmail(email)
  }
  catch (error) {
    throw createError({ statusCode: 502, statusMessage: error instanceof Error ? error.message : 'Échec de l\'envoi' })
  }
  return { ok: true }
})
