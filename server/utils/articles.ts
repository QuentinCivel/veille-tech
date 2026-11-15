import { createHash, randomUUID } from 'node:crypto'
import type { DocumentSnapshot, Query } from 'firebase-admin/firestore'

// Données d'un article telles que stockées dans Firestore (dates en Timestamp + jetons de recherche).
type ArticleDoc = Omit<Article, 'id'> & { searchTokens: string[] }

export interface ArticleDraft {
  title: string
  summary: string
  content: string
  url: string
  sourceName: string
  sourceType: SourceType
  externalId: string | null
  type: ArticleType
  severity: Severity | null
  technologies: string[]
  tags: string[]
  version: string | null
  cve: CveInfo | null
  status: ArticleStatus
  publishedAt: string
}

/**
 * Identifiant lisible et stable : "nuxt-v4-6-1-3fa9c2b1".
 * Pour un article importé, le hash dépend de l'identifiant externe → ré-importer ne crée pas de doublon.
 */
export function articleIdFor(title: string, externalId: string | null): string {
  const hash = createHash('sha256').update(externalId ?? randomUUID()).digest('hex').slice(0, 8)
  return `${slugify(title, 70) || 'article'}-${hash}`
}

export function buildArticleData(draft: ArticleDraft, techIndex: TechIndex) {
  const techNames = techIndex.names
  const now = new Date().toISOString()
  const searchTokens = buildSearchTokens({
    title: draft.title,
    body: [draft.summary],
    exact: [
      ...draft.technologies,
      ...draft.technologies.map(slug => techNames[slug] ?? ''),
      ...draft.tags,
      ...(draft.cve?.ids ?? []),
      draft.version ?? ''
    ]
  })
  return {
    ...draft,
    severity: draft.type === 'security' ? draft.severity : null,
    isCritical: isCriticalArticle(draft.type, draft.severity),
    listed: isListedArticle(draft.status, draft.technologies, techIndex.publicSlugs),
    searchTokens,
    publishedAt: toTimestamp(draft.publishedAt),
    updatedAt: toTimestamp(now)
  }
}

export function snapshotToArticle(snapshot: DocumentSnapshot): Article {
  const data = serializeDoc<ArticleDoc>(snapshot.data() ?? {})
  const { searchTokens: _tokens, ...rest } = data
  return {
    ...rest,
    id: snapshot.id,
    listed: rest.listed ?? false,
    alert: rest.alert ?? { state: 'none', sentAt: null, lastError: null }
  }
}

export function toListItem(article: Article): ArticleListItem {
  const { content: _content, externalId: _externalId, ...item } = article
  return item
}

/** Ancien tag (supprimé) qui révélait qu'une faille touchait le projet suivi. */
const PRIVATE_TAGS = new Set(['version-projet-concernee'])

/**
 * Version publique d'un article :
 *  - l'impact sur le projet suivi (cve.affectsProject) n'est jamais exposé, sinon le site indiquerait
 *    publiquement quelles failles sont exploitables sur ce projet ;
 *  - les technologies privées sont retirées (cas d'un article rattaché à une technologie publique ET privée).
 */
export function publicArticle<T extends Pick<Article, 'cve' | 'tags' | 'technologies'>>(article: T, publicSlugs: ReadonlySet<string>): T {
  return {
    ...article,
    technologies: article.technologies.filter(slug => publicSlugs.has(slug)),
    tags: article.tags.filter(tag => !PRIVATE_TAGS.has(tag)),
    cve: article.cve ? { ...article.cve, affectsProject: null } : null
  }
}

export async function getArticleById(id: string): Promise<Article | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(id)) return null
  const snapshot = await useFirestore().collection(COLLECTIONS.articles).doc(id).get()
  return snapshot.exists ? snapshotToArticle(snapshot) : null
}

/** Création / modification depuis l'administration. Retourne l'identifiant du document. */
export async function saveManualArticle(input: ArticleInput, existing: Article | null): Promise<string> {
  const now = new Date().toISOString()
  const isSecurity = input.type === 'security'
  const cve: CveInfo | null = isSecurity
    ? {
        // On conserve les plages de versions d'une faille importée (OSV) que l'admin retouche.
        affectedRanges: existing?.cve?.affectedRanges ?? [],
        patchedVersions: existing?.cve?.patchedVersions ?? [],
        affectsProject: existing?.cve?.affectsProject ?? null,
        ids: input.cveIds,
        cvss: input.cvss
      }
    : null

  const draft: ArticleDraft = {
    title: input.title,
    summary: input.summary,
    content: input.content,
    url: input.url,
    sourceName: input.sourceName || existing?.sourceName || 'Saisie manuelle',
    sourceType: existing?.sourceType ?? 'manual',
    externalId: existing?.externalId ?? null,
    type: input.type,
    severity: isSecurity ? input.severity : null,
    technologies: input.technologies,
    tags: [...new Set(input.tags)],
    version: input.version || null,
    cve,
    status: input.status,
    publishedAt: input.publishedAt ?? existing?.publishedAt ?? now
  }

  const data = buildArticleData(draft, await getTechIndex({ fresh: true }))
  const collection = useFirestore().collection(COLLECTIONS.articles)
  if (existing) {
    await collection.doc(existing.id).update(data)
    return existing.id
  }
  const id = articleIdFor(input.title, null)
  await collection.doc(id).create({
    ...data,
    createdAt: toTimestamp(now),
    alert: { state: 'none', sentAt: null, lastError: null }
  })
  return id
}

/**
 * Recalcule le champ "listed" (visibilité publique) après un changement de visibilité d'une technologie,
 * pour ses seuls articles, ou pour toute la base si aucun slug n'est donné. Retourne le nombre d'articles modifiés.
 */
export async function refreshListing(slug?: string): Promise<number> {
  const db = useFirestore()
  const { publicSlugs } = await getTechIndex({ fresh: true })
  const base = db.collection(COLLECTIONS.articles)
  const snapshot = await (slug ? base.where('technologies', 'array-contains', slug) : base)
    .select('status', 'technologies', 'listed')
    .get()

  const changes = snapshot.docs.flatMap((doc) => {
    const listed = isListedArticle(doc.get('status'), doc.get('technologies') ?? [], publicSlugs)
    return doc.get('listed') === listed ? [] : [{ ref: doc.ref, listed }]
  })
  // Écritures groupées (Firestore : 500 opérations maximum par lot).
  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch()
    changes.slice(i, i + 400).forEach(change => batch.update(change.ref, { listed: change.listed }))
    await batch.commit()
  }
  return changes.length
}

const LIST_FIELDS = [
  'title', 'summary', 'url', 'sourceName', 'sourceType', 'type', 'severity', 'isCritical', 'technologies',
  'tags', 'version', 'cve', 'status', 'listed', 'publishedAt', 'createdAt', 'updatedAt', 'alert', 'searchTokens'
]

/**
 * Fil d'actualités paginé.
 * Firestore n'autorise qu'un seul filtre "array-contains" par requête : on l'applique au critère le plus
 * sélectif (recherche > technologie > tag) et les autres critères sont filtrés en mémoire.
 */
export async function queryArticles(filters: FeedQuery & { status?: ArticleStatus, listedOnly?: boolean }): Promise<ArticlePage> {
  const collection = useFirestore().collection(COLLECTIONS.articles)
  const words = filters.q ? [...new Set(tokenize(filters.q))] : []

  let query: Query = collection
  // Site public : uniquement les articles "listés" (publiés et rattachés à une technologie publique).
  if (filters.listedOnly) query = query.where('listed', '==', true)
  if (filters.status) query = query.where('status', '==', filters.status)
  if (filters.type) query = query.where('type', '==', filters.type)
  if (filters.critical) query = query.where('isCritical', '==', true)

  const memoryChecks: Array<(doc: DocumentSnapshot) => boolean> = []
  const tokensOf = (doc: DocumentSnapshot) => (doc.get('searchTokens') ?? []) as string[]
  const techsOf = (doc: DocumentSnapshot) => (doc.get('technologies') ?? []) as string[]
  const tagsOf = (doc: DocumentSnapshot) => (doc.get('tags') ?? []) as string[]

  if (words.length) {
    query = query.where('searchTokens', 'array-contains', words[0])
    if (words.length > 1) memoryChecks.push(doc => words.slice(1).every(word => tokensOf(doc).includes(word)))
    if (filters.tech) memoryChecks.push(doc => techsOf(doc).includes(filters.tech!))
    if (filters.tag) memoryChecks.push(doc => tagsOf(doc).includes(filters.tag!))
  }
  else if (filters.tech) {
    query = query.where('technologies', 'array-contains', filters.tech)
    if (filters.tag) memoryChecks.push(doc => tagsOf(doc).includes(filters.tag!))
  }
  else if (filters.tag) {
    query = query.where('tags', 'array-contains', filters.tag)
  }

  query = query.orderBy('publishedAt', 'desc').select(...LIST_FIELDS)

  if (filters.cursor) {
    const cursorDoc = await collection.doc(filters.cursor).get()
    if (cursorDoc.exists) query = query.startAfter(cursorDoc)
  }

  const limit = filters.limit
  // Sans filtre mémoire, une seule lecture de (limit + 1) documents suffit à savoir s'il reste une page.
  if (!memoryChecks.length) {
    const snapshot = await query.limit(limit + 1).get()
    const docs = snapshot.docs.slice(0, limit)
    return {
      items: docs.map(doc => toListItem(snapshotToArticle(doc))),
      nextCursor: snapshot.docs.length > limit ? docs.at(-1)!.id : null
    }
  }

  // Avec filtres mémoire : lots successifs (bornés) jusqu'à remplir la page.
  const batchSize = Math.min(limit * 3, 100)
  const items: ArticleListItem[] = []
  let lastExamined: DocumentSnapshot | null = null
  for (let round = 0; round < 4; round++) {
    const snapshot = await (lastExamined ? query.startAfter(lastExamined) : query).limit(batchSize).get()
    for (const doc of snapshot.docs) {
      lastExamined = doc
      if (!memoryChecks.every(check => check(doc))) continue
      items.push(toListItem(snapshotToArticle(doc)))
      if (items.length === limit) return { items, nextCursor: doc.id }
    }
    if (snapshot.docs.length < batchSize) return { items, nextCursor: null }
  }
  return { items, nextCursor: lastExamined?.id ?? null }
}
