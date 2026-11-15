import type { Config } from '@netlify/functions'

// Scheduled Function Netlify (offre gratuite) : déclenche la collecte toutes les 30 minutes.
// Elle se contente d'appeler la route Nuxt protégée par le secret partagé NUXT_CRON_SECRET.
export default async () => {
  const siteUrl = process.env.URL
  const secret = process.env.NUXT_CRON_SECRET
  if (!siteUrl || !secret) {
    console.error('URL ou NUXT_CRON_SECRET manquant')
    return
  }

  const response = await fetch(`${siteUrl}/api/cron/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25_000)
  })
  console.log(`Collecte : HTTP ${response.status}`, await response.text())
}

export const config: Config = {
  schedule: '*/30 * * * *'
}
