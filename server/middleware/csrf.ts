// Protection CSRF en complément du cookie SameSite=Strict :
// toute requête qui modifie des données doit provenir du même site (en-tête Origin).
// La route cron est exclue : elle est appelée de serveur à serveur avec un jeton Bearer.

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler((event) => {
  if (!UNSAFE_METHODS.has(event.method)) return
  const path = event.path
  if (!path.startsWith('/api/') || path.startsWith('/api/cron/')) return

  const origin = getHeader(event, 'origin')
  const host = getRequestHost(event, { xForwardedHost: true })
  let originHost: string | null = null
  try {
    originHost = origin ? new URL(origin).host : null
  }
  catch {
    originHost = null
  }
  if (!originHost || originHost !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Origine de la requête refusée' })
  }
})
