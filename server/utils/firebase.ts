import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'

// Firebase Admin s'exécute uniquement côté serveur (Nitro) : il contourne les règles Firestore,
// qui interdisent tout accès direct depuis le navigateur (voir firestore.rules).

let app: App | undefined
let db: Firestore | undefined

function getAdminApp(): App {
  if (app) return app
  const existing = getApps()[0]
  if (existing) return (app = existing)

  const config = useRuntimeConfig()
  if (!config.firebaseProjectId || !config.firebaseClientEmail || !config.firebasePrivateKey) {
    throw createError({ statusCode: 503, statusMessage: 'Firebase Admin non configuré (voir .env.example)' })
  }
  app = initializeApp({
    credential: cert({
      projectId: config.firebaseProjectId,
      clientEmail: config.firebaseClientEmail,
      // Les hébergeurs stockent la clé sur une ligne : on restaure les retours à la ligne.
      privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n')
    })
  })
  return app
}

export function useFirestore(): Firestore {
  if (db) return db
  db = getFirestore(getAdminApp())
  try {
    db.settings({ ignoreUndefinedProperties: true })
  }
  catch {
    // Déjà initialisé (rechargement à chaud en développement) : réglage déjà appliqué.
  }
  return db
}

export function useAdminAuth() {
  return getAuth(getAdminApp())
}

export const COLLECTIONS = {
  articles: 'articles',
  technologies: 'technologies',
  subscribers: 'subscribers',
  alerts: 'alerts',
  ingestRuns: 'ingestRuns',
  settings: 'settings'
} as const

/** Convertit récursivement les Timestamp Firestore en chaînes ISO (sérialisables en JSON). */
export function serializeDoc<T>(data: FirebaseFirestore.DocumentData): T {
  const walk = (value: unknown): unknown => {
    if (value instanceof Timestamp) return value.toDate().toISOString()
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, walk(inner)]))
    }
    return value
  }
  return walk(data) as T
}

export function toTimestamp(iso: string | Date): Timestamp {
  return Timestamp.fromDate(typeof iso === 'string' ? new Date(iso) : iso)
}
