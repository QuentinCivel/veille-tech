import { timingSafeEqual } from 'node:crypto'

// Appelée par la Scheduled Function Netlify (netlify/functions/ingest-cron.mts) avec un jeton secret.
export default defineEventHandler(async (event) => {
  // Lecture brute de la variable d'environnement : runtimeConfig convertit les valeurs qui ressemblent
  // à des nombres (ex. un secret hexadécimal "8e12…"), ce qui fausserait la comparaison.
  const cronSecret = process.env.NUXT_CRON_SECRET ?? String(useRuntimeConfig().cronSecret ?? '')
  const provided = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
  const expected = Buffer.from(cronSecret)
  const received = Buffer.from(provided)
  // Comparaison à temps constant (évite de deviner le secret caractère par caractère).
  if (!cronSecret || cronSecret.length < 32 || expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw createError({ statusCode: 401, statusMessage: 'Jeton cron invalide' })
  }
  const run = await runIngestion('cron')
  return { id: run.id, technologies: run.technologiesProcessed, created: run.created, alertsSent: run.alertsSent, errors: run.errors }
})
