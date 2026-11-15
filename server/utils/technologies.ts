import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'

/** État interne de la collecte, stocké sur le document technologie (jamais exposé au public). */
export interface TechIngestState {
  lastRunAt?: string
  lastError?: string | null
  /** Curseurs : date de la dernière entrée traitée par source. */
  github?: string
  osv?: string
  rss?: Record<string, string>
}

export type StoredTechnology = Technology & { ingest: TechIngestState }

export function snapshotToTechnology(snapshot: DocumentSnapshot): StoredTechnology {
  const data = serializeDoc<Partial<StoredTechnology>>(snapshot.data() ?? {})
  const ingest = (data.ingest ?? {}) as TechIngestState
  return {
    slug: snapshot.id,
    name: data.name ?? snapshot.id,
    category: data.category ?? 'tooling',
    origin: data.origin ?? 'manual',
    description: data.description ?? '',
    website: data.website ?? '',
    npmPackage: data.npmPackage ?? '',
    githubRepo: data.githubRepo ?? '',
    tagPrefix: data.tagPrefix ?? '',
    releaseMinLevel: data.releaseMinLevel ?? 'patch',
    rssFeeds: data.rssFeeds ?? [],
    projectVersion: data.projectVersion ?? '',
    latestVersion: data.latestVersion ?? null,
    lastIngestAt: ingest.lastRunAt ?? null,
    lastIngestError: ingest.lastError ?? null,
    tracked: data.tracked ?? true,
    private: data.private ?? false,
    order: data.order ?? 100,
    createdAt: data.createdAt ?? '',
    updatedAt: data.updatedAt ?? '',
    ingest
  }
}

/** Version admin : tout sauf les curseurs internes de collecte. */
export function adminTechnology(tech: StoredTechnology): Technology {
  const { ingest: _ingest, ...rest } = tech
  return rest
}

/**
 * Version publique : liste blanche des champs. Rien ne permet de relier la veille au projet suivi
 * (ni version utilisée, ni origine « package.json », ni messages d'erreur internes).
 */
export function publicTechnology(tech: StoredTechnology): PublicTechnology {
  return {
    slug: tech.slug,
    name: tech.name,
    category: tech.category,
    description: tech.description,
    website: tech.website,
    npmPackage: tech.npmPackage,
    githubRepo: tech.githubRepo,
    tagPrefix: tech.tagPrefix,
    releaseMinLevel: tech.releaseMinLevel,
    rssFeeds: tech.rssFeeds,
    latestVersion: tech.latestVersion
  }
}

export async function listTechnologies(): Promise<StoredTechnology[]> {
  const snapshot = await useFirestore().collection(COLLECTIONS.technologies).get()
  return snapshot.docs
    .map(snapshotToTechnology)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'))
}

/** Index léger des technologies : noms (jetons de recherche, e-mails) et slugs publics (visibilité). */
export interface TechIndex {
  names: Record<string, string>
  publicSlugs: ReadonlySet<string>
}

let techIndexCache: { at: number, value: TechIndex } | null = null
const TECH_INDEX_TTL_MS = 60_000

/**
 * Index mis en cache 60 s par instance serveur : le site public le consulte à chaque requête
 * (filtrage des technologies privées) sans relire toute la collection à chaque fois.
 */
export async function getTechIndex(options: { fresh?: boolean } = {}): Promise<TechIndex> {
  if (!options.fresh && techIndexCache && Date.now() - techIndexCache.at < TECH_INDEX_TTL_MS) return techIndexCache.value
  const snapshot = await useFirestore().collection(COLLECTIONS.technologies).select('name', 'private').get()
  const value: TechIndex = {
    names: Object.fromEntries(snapshot.docs.map(doc => [doc.id, String(doc.get('name') ?? doc.id)])),
    publicSlugs: new Set(snapshot.docs.filter(doc => doc.get('private') !== true).map(doc => doc.id))
  }
  techIndexCache = { at: Date.now(), value }
  return value
}

/** À appeler après toute modification de technologie (nom, visibilité, suppression). */
export function invalidateTechIndex() {
  techIndexCache = null
}

export async function getTechnology(slug: string): Promise<StoredTechnology | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  const snapshot = await useFirestore().collection(COLLECTIONS.technologies).doc(slug).get()
  return snapshot.exists ? snapshotToTechnology(snapshot) : null
}

export async function saveTechnology(input: TechnologyInput, mode: 'create' | 'update'): Promise<void> {
  const ref = useFirestore().collection(COLLECTIONS.technologies).doc(input.slug)
  const { slug: _slug, ...fields } = input
  if (mode === 'create') {
    await ref.create({
      ...fields,
      latestVersion: null,
      ingest: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    })
  }
  else {
    await ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() })
  }
  invalidateTechIndex()
}

/** Code d'erreur gRPC Firestore "ALREADY_EXISTS" (document déjà présent lors d'un create()). */
export function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 6
}
