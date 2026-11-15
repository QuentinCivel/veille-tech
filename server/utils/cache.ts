import type { H3Event } from 'h3'

/**
 * Cache CDN court sur les données publiques, pour économiser le quota Firestore (offre Spark).
 * À appeler juste avant de renvoyer une réponse réussie : une erreur n'est jamais mise en cache.
 */
export function publicCache(event: H3Event, seconds: number) {
  const value = `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`
  setHeader(event, 'Cache-Control', value)
  // En-tête spécifique Netlify, prioritaire pour son CDN.
  setHeader(event, 'Netlify-CDN-Cache-Control', value)
}
