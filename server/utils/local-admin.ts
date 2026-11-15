import type { H3Event } from 'h3'
import { isLocalRequest } from '../lib/local-admin'

// Pas de comptes utilisateurs : l'administration n'existe qu'en développement, sur la machine locale.
//  - En production (build), import.meta.dev vaut false : toutes les routes admin répondent 404,
//    et les pages /admin sont retirées du build (voir le module inline de nuxt.config.ts).
//  - En développement, seules les requêtes émises depuis la machine elle-même sont acceptées
//    (adresse de loopback + en-tête Host local). Ne pas exposer le serveur de dev sur le réseau (--host).

export function isLocalAdminRequest(event: H3Event): boolean {
  if (!import.meta.dev) return false
  return isLocalRequest({
    socketIp: event.node.req.socket?.remoteAddress,
    forwardedFor: getHeader(event, 'x-forwarded-for'),
    host: getHeader(event, 'host')
  })
}

export function requireLocalAdmin(event: H3Event): void {
  // 404 plutôt que 403 : en production, l'administration n'existe tout simplement pas.
  if (!isLocalAdminRequest(event)) throw createError({ statusCode: 404, statusMessage: 'Page introuvable' })
}

/**
 * Gestionnaire de route réservé à l'administration locale. Double la vérification du middleware
 * server/middleware/admin.ts (défense en profondeur).
 */
export function defineAdminHandler<T>(handler: (event: H3Event) => Promise<T>) {
  return defineEventHandler(async (event) => {
    requireLocalAdmin(event)
    return handler(event)
  })
}
