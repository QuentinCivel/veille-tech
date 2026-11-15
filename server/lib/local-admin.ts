// Règles pures (testables) qui définissent une requête "locale" : elle vient de la machine du développeur.

const LOOPBACK = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/

export function isLoopbackAddress(ip: string | undefined | null): boolean {
  return Boolean(ip) && LOOPBACK.test(ip!.trim())
}

/** En-tête Host "localhost:3000", "127.0.0.1:3000" ou "[::1]:3000" (protège aussi du DNS rebinding). */
export function isLocalHostHeader(host: string | undefined | null): boolean {
  if (!host) return false
  const hostname = host.trim().toLowerCase().replace(/:\d+$/, '')
  return hostname === 'localhost' || hostname === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
}

/** Toutes les adresses de la chaîne X-Forwarded-For (si présente) doivent aussi être locales. */
export function isLocalForwardedFor(header: string | undefined | null): boolean {
  if (!header) return true
  return header.split(',').every(ip => isLoopbackAddress(ip))
}

/**
 * Requête émise depuis la machine locale ?
 * Le serveur de dev de Nuxt relaie les requêtes vers Nitro par un canal interne (pipe) : l'adresse du socket
 * est alors absente et l'IP réelle du client est transmise dans X-Forwarded-For.
 */
export function isLocalRequest(input: { socketIp?: string | null, forwardedFor?: string | null, host?: string | null }): boolean {
  const fromClient = input.socketIp
    ? isLoopbackAddress(input.socketIp) && isLocalForwardedFor(input.forwardedFor)
    : Boolean(input.forwardedFor) && isLocalForwardedFor(input.forwardedFor)
  return fromClient && isLocalHostHeader(input.host)
}
