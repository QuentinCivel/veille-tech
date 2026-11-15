import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'
import type { ArticleType, RssFeed } from '../../../shared/types/veille'
import { isHttpUrl, slugify } from '../../../shared/utils/veille'
import { stripHtml } from '../../utils/markdown'
import { fetchText } from '../http'
import type { IngestedItem } from './types'

export interface FeedEntry {
  title: string
  link: string
  html: string
  date: string | null
  guid: string
  categories: string[]
}

export interface ParsedFeed {
  title: string
  entries: FeedEntry[]
}

// fast-xml-parser ne résout pas les entités externes (pas de faille XXE).
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: name => ['item', 'entry', 'category', 'link'].includes(name)
})

/** Valeur textuelle d'un nœud XML qui peut être une chaîne, un objet {#text} ou un CDATA. */
function text(node: unknown): string {
  if (node === undefined || node === null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim()
  if (Array.isArray(node)) return text(node[0])
  if (typeof node === 'object' && '#text' in node) return text((node as Record<string, unknown>)['#text'])
  return ''
}

function toIsoDate(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Gère RSS 2.0 et Atom. */
export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml) as Record<string, any>

  if (doc.rss?.channel) {
    const channel = Array.isArray(doc.rss.channel) ? doc.rss.channel[0] : doc.rss.channel
    return {
      title: text(channel.title),
      entries: (channel.item ?? []).map((item: Record<string, unknown>): FeedEntry => {
        const link = text(item.link)
        return {
          title: stripHtml(text(item.title)),
          link,
          html: text(item['content:encoded']) || text(item.description),
          date: toIsoDate(text(item.pubDate) || text(item['dc:date'])),
          guid: text(item.guid) || link,
          categories: ((item.category as unknown[]) ?? []).map(text).filter(Boolean)
        }
      })
    }
  }

  if (doc.feed) {
    const feed = doc.feed
    return {
      title: text(feed.title),
      entries: (feed.entry ?? []).map((entry: Record<string, any>): FeedEntry => {
        const links = (entry.link ?? []) as Array<Record<string, string>>
        const alternate = links.find(l => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0]
        const link = alternate?.['@_href'] ?? ''
        return {
          title: stripHtml(text(entry.title)),
          link,
          html: text(entry.content) || text(entry.summary),
          date: toIsoDate(text(entry.published) || text(entry.updated)),
          guid: text(entry.id) || link,
          categories: ((entry.category ?? []) as Array<Record<string, string>>).map(c => c['@_term'] ?? text(c)).filter(Boolean)
        }
      })
    }
  }

  throw new Error('Format de flux non reconnu (ni RSS 2.0 ni Atom)')
}

const SECURITY_HINT = /\b(security|vulnerabilit(y|ies)|CVE-\d{4}-\d+|faille|sécurité)\b/i
const TUTORIAL_HINT = /\b(tutorial|tutoriel|guide|how to|getting started|step[- ]by[- ]step)\b/i

export function classifyEntry(entry: Pick<FeedEntry, 'title' | 'categories'>, defaultType: ArticleType): ArticleType {
  if (defaultType !== 'news') return defaultType
  const haystack = `${entry.title} ${entry.categories.join(' ')}`
  if (SECURITY_HINT.test(haystack)) return 'security'
  if (TUTORIAL_HINT.test(haystack)) return 'tutorial'
  return 'news'
}

export function entryToItem(entry: FeedEntry, feed: RssFeed, feedTitle: string, now = new Date()): IngestedItem | null {
  if (!entry.title || !isHttpUrl(entry.link)) return null
  const plain = stripHtml(entry.html)
  const summary = plain.length > 280 ? `${plain.slice(0, 277).replace(/\s+\S*$/, '')}…` : plain
  const publishedAt = entry.date ?? now.toISOString()
  const key = createHash('sha256').update(`${feed.url}|${entry.guid}`).digest('hex').slice(0, 24)

  return {
    idLabel: entry.title,
    externalId: `rss:${key}`,
    title: entry.title.slice(0, 200),
    summary,
    content: entry.html.slice(0, 20_000),
    url: entry.link,
    sourceName: feedTitle || new URL(feed.url).host,
    sourceType: 'rss',
    type: classifyEntry(entry, feed.defaultType),
    severity: null,
    tags: [...new Set(entry.categories.map(c => slugify(c, 40)).filter(Boolean))].slice(0, 5),
    version: null,
    cve: null,
    publishedAt,
    cursorDate: publishedAt
  }
}

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const xml = await fetchText(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } })
  return parseFeed(xml)
}
