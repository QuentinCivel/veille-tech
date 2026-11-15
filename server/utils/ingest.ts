import { createHash } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { fetchGithubReleases, releaseToItem } from '../lib/ingest/github'
import { minimalVersion, queryOsv, vulnToItem } from '../lib/ingest/osv'
import { entryToItem, fetchFeed } from '../lib/ingest/rss'
import type { IngestedItem } from '../lib/ingest/types'
import { fetchJson } from '../lib/http'

// Collecte automatique, conçue pour une fonction serverless courte (Netlify : 10 s) :
//  - les technologies les moins récemment collectées passent en premier (rotation) ;
//  - on s'arrête de démarrer de nouvelles technologies une fois le budget de temps entamé ;
//  - des curseurs (date de la dernière entrée vue) évitent de relire Firestore pour des entrées connues.

const RSS_FIRST_RUN_LIMIT = 15

interface TechResult {
  stats: IngestSourceStat[]
  createdSecurityIds: string[]
  cursors: Partial<TechIngestState>
  latestVersion: string | null
}

function feedKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 12)
}

function newerThan(cursor: string | undefined) {
  return (item: IngestedItem) => !cursor || item.cursorDate > cursor
}

function maxCursor(items: IngestedItem[], previous: string | undefined): string | undefined {
  return items.reduce<string | undefined>((max, item) => (!max || item.cursorDate > max ? item.cursorDate : max), previous)
}

/** Écrit les entrées en base : création si nouvelle, sinon mise à jour minimale (sans écraser les retouches admin). */
async function storeItems(items: IngestedItem[], tech: StoredTechnology, techIndex: TechIndex) {
  const collection = useFirestore().collection(COLLECTIONS.articles)
  let created = 0
  let updated = 0
  const createdSecurityIds: string[] = []

  for (const { idLabel, cursorDate: _cursor, ...item } of items) {
    const id = articleIdFor(idLabel, item.externalId)
    const data = buildArticleData({ ...item, technologies: [tech.slug], status: 'published' }, techIndex)
    try {
      await collection.doc(id).create({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        alert: { state: 'none', sentAt: null, lastError: null }
      })
      created++
      if (item.type === 'security') createdSecurityIds.push(id)
    }
    catch (error) {
      if (!isAlreadyExists(error)) throw error
      // Déjà connu (autre technologie, ou faille OSV modifiée) : on complète sans toucher au contenu édité.
      const ref = collection.doc(id)
      await ref.update({
        technologies: FieldValue.arrayUnion(tech.slug),
        searchTokens: FieldValue.arrayUnion(tech.slug, normalizeText(tech.name)),
        ...(item.sourceType === 'osv'
          ? { severity: item.severity, isCritical: isCriticalArticle('security', item.severity), cve: item.cve }
          : {}),
        updatedAt: FieldValue.serverTimestamp()
      })
      // Une technologie publique ajoutée peut rendre visible un article jusque-là rattaché à des technologies privées.
      if (techIndex.publicSlugs.has(tech.slug)) {
        const snapshot = await ref.get()
        const listed = isListedArticle(snapshot.get('status'), snapshot.get('technologies') ?? [], techIndex.publicSlugs)
        if (snapshot.get('listed') !== listed) await ref.update({ listed })
      }
      updated++
    }
  }
  return { created, updated, createdSecurityIds }
}

async function ingestTechnology(tech: StoredTechnology, techIndex: TechIndex, githubToken: string): Promise<TechResult> {
  const stats: IngestSourceStat[] = []
  const createdSecurityIds: string[] = []
  const cursors: Partial<TechIngestState> = { rss: { ...tech.ingest.rss } }
  let latestVersion: string | null = tech.latestVersion

  const run = async (source: IngestSourceStat['source'], task: () => Promise<{ created: number, updated: number }>) => {
    try {
      const result = await task()
      stats.push({ technology: tech.slug, source, ...result, error: null })
    }
    catch (error) {
      stats.push({ technology: tech.slug, source, created: 0, updated: 0, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const store = async (items: IngestedItem[]) => {
    const result = await storeItems(items, tech, techIndex)
    createdSecurityIds.push(...result.createdSecurityIds)
    return result
  }

  const tasks: Promise<void>[] = []

  if (tech.githubRepo) {
    tasks.push(run('github', async () => {
      const releases = await fetchGithubReleases(tech.githubRepo, githubToken)
      const items = releases.map(release => releaseToItem(release, tech)).filter((item): item is IngestedItem => item !== null)
      if (!tech.npmPackage && items[0]) latestVersion = items[0].version
      const fresh = items.filter(newerThan(tech.ingest.github))
      // Le curseur n'avance qu'après une écriture réussie.
      const result = await store(fresh)
      cursors.github = maxCursor(fresh, tech.ingest.github)
      return result
    }))
  }

  if (tech.npmPackage) {
    tasks.push(run('osv', async () => {
      const vulns = await queryOsv(tech.npmPackage)
      const fresh = vulns.filter(vuln => !tech.ingest.osv || vuln.modified > tech.ingest.osv)
      if (!fresh.length) return { created: 0, updated: 0 }

      // Deuxième requête : quelles failles touchent la version déclarée dans le projet ?
      const version = minimalVersion(tech.projectVersion)
      const affecting = version ? new Set((await queryOsv(tech.npmPackage, version)).map(vuln => vuln.id)) : null
      const items = fresh.map(vuln => vulnToItem(vuln, tech, affecting)).filter((item): item is IngestedItem => item !== null)
      const result = await store(items)
      cursors.osv = maxCursor(items, tech.ingest.osv)
      return result
    }))

    tasks.push((async () => {
      const latest = await fetchJson<{ version?: string }>(`https://registry.npmjs.org/${tech.npmPackage.replace('/', '%2F')}/latest`)
        .catch(() => null)
      if (latest?.version) latestVersion = latest.version
    })())
  }

  for (const feed of tech.rssFeeds) {
    tasks.push(run('rss', async () => {
      const key = feedKey(feed.url)
      const parsed = await fetchFeed(feed.url)
      const items = parsed.entries
        .map(entry => entryToItem(entry, feed, parsed.title))
        .filter((item): item is IngestedItem => item !== null)
        .sort((a, b) => b.cursorDate.localeCompare(a.cursorDate))
      const previous = tech.ingest.rss?.[key]
      const fresh = previous ? items.filter(newerThan(previous)) : items.slice(0, RSS_FIRST_RUN_LIMIT)
      const result = await store(fresh)
      const next = maxCursor(fresh, previous)
      if (next) cursors.rss![key] = next
      return result
    }))
  }

  await Promise.all(tasks)
  return { stats, createdSecurityIds, cursors, latestVersion }
}

export async function runIngestion(
  trigger: IngestRun['trigger'],
  options: { budgetMs?: number, only?: string } = {}
): Promise<IngestRun> {
  const startedAt = new Date()
  const budgetMs = options.budgetMs ?? 6000
  const db = useFirestore()
  const { githubToken } = useRuntimeConfig()

  const allTechnologies = await listTechnologies()
  // Index construit sur TOUTES les technologies (pas seulement celles collectées) : noms + visibilité publique.
  const techIndex: TechIndex = {
    names: Object.fromEntries(allTechnologies.map(tech => [tech.slug, tech.name])),
    publicSlugs: new Set(allTechnologies.filter(tech => !tech.private).map(tech => tech.slug))
  }
  const technologies = allTechnologies
    .filter(tech => tech.tracked && (!options.only || tech.slug === options.only))
    .sort((a, b) => (a.ingest.lastRunAt ?? '').localeCompare(b.ingest.lastRunAt ?? ''))

  const stats: IngestSourceStat[] = []
  const processed: string[] = []
  const securityIds: string[] = []

  for (const tech of technologies) {
    // On garde du temps pour les alertes et l'écriture du rapport.
    if (processed.length && Date.now() - startedAt.getTime() > budgetMs * 0.6) break
    const result = await ingestTechnology(tech, techIndex, githubToken)
    stats.push(...result.stats)
    securityIds.push(...result.createdSecurityIds)
    processed.push(tech.slug)

    const errors = result.stats.filter(stat => stat.error).map(stat => `${stat.source} : ${stat.error}`)
    await db.collection(COLLECTIONS.technologies).doc(tech.slug).update({
      latestVersion: result.latestVersion,
      'ingest.lastRunAt': new Date().toISOString(),
      'ingest.lastError': errors.length ? errors.join(' | ').slice(0, 500) : null,
      ...(result.cursors.github ? { 'ingest.github': result.cursors.github } : {}),
      ...(result.cursors.osv ? { 'ingest.osv': result.cursors.osv } : {}),
      'ingest.rss': result.cursors.rss ?? {}
    })
  }

  // Alertes pour les nouvelles failles (la règle d'éligibilité filtre gravité, âge et version concernée).
  let alertsSent = 0
  for (const id of securityIds) {
    const result = await dispatchSecurityAlert(id, 'ingest')
    if (result.status === 'sent') alertsSent++
  }
  if (Date.now() - startedAt.getTime() < budgetMs) alertsSent += await retryFailedAlerts(3)

  const run: Omit<IngestRun, 'id'> = {
    trigger,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    technologiesProcessed: processed,
    created: stats.reduce((sum, stat) => sum + stat.created, 0),
    updated: stats.reduce((sum, stat) => sum + stat.updated, 0),
    alertsSent,
    errors: stats.filter(stat => stat.error).length,
    stats
  }
  const ref = await db.collection(COLLECTIONS.ingestRuns).add({
    ...run,
    startedAt: Timestamp.fromDate(startedAt),
    finishedAt: FieldValue.serverTimestamp()
  })
  await pruneIngestRuns()
  return { id: ref.id, ...run }
}

/** Conserve 30 jours d'historique de collecte. */
async function pruneIngestRuns() {
  const limitDate = Timestamp.fromMillis(Date.now() - 30 * 86_400_000)
  const old = await useFirestore().collection(COLLECTIONS.ingestRuns).where('startedAt', '<', limitDate).limit(50).get()
  if (old.empty) return
  const batch = useFirestore().batch()
  old.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
}
