// Types partagés entre l'application (app/) et le serveur (server/).
// Les dates circulent en chaînes ISO 8601 : Firestore Timestamp n'est pas sérialisable en JSON.

export type ArticleType = 'update' | 'security' | 'tutorial' | 'news'
export type Severity = 'low' | 'moderate' | 'high' | 'critical'
export type ArticleStatus = 'draft' | 'published'
export type SourceType = 'manual' | 'github-release' | 'osv' | 'rss'
export type AlertState = 'none' | 'sending' | 'sent' | 'failed'
export type ReleaseLevel = 'patch' | 'minor' | 'major'

export type TechCategory =
  | 'framework'
  | 'ui'
  | 'runtime'
  | 'language'
  | 'backend'
  | 'database'
  | 'auth'
  | 'email'
  | 'testing'
  | 'tooling'
  | 'hosting'

export type TechOrigin = 'project' | 'implicit' | 'tooling-app' | 'manual'

export interface RssFeed {
  url: string
  /** Type attribué par défaut aux entrées de ce flux (ex. flux "vulnérabilités" de Node.js). */
  defaultType: ArticleType
}

export interface Technology {
  slug: string
  name: string
  category: TechCategory
  origin: TechOrigin
  description: string
  website: string
  /** Paquet npm interrogé sur OSV (failles) et le registre npm (dernière version). */
  npmPackage: string
  /** "owner/repo" pour l'API GitHub Releases. */
  githubRepo: string
  /** Préfixe des tags dans un monorepo (ex. "firebase@"). */
  tagPrefix: string
  /** Niveau minimal de release importé (évite le bruit des patchs). */
  releaseMinLevel: ReleaseLevel
  rssFeeds: RssFeed[]
  /** Version utilisée par le projet suivi (ex. "^4.4.8"). */
  projectVersion: string
  latestVersion: string | null
  lastIngestAt: string | null
  lastIngestError: string | null
  tracked: boolean
  /** Suivie en privé : collectée et visible dans l'admin, absente du site public (elle et ses articles). */
  private: boolean
  order: number
  createdAt: string
  updatedAt: string
}

/**
 * Technologie telle qu'exposée par l'API publique : aucune information sur le projet suivi
 * (version utilisée, origine, état interne de la collecte). Ces données restent réservées à l'admin locale.
 */
export type PublicTechnology = Omit<
  Technology,
  'projectVersion' | 'origin' | 'lastIngestAt' | 'lastIngestError' | 'tracked' | 'private' | 'order' | 'createdAt' | 'updatedAt'
>

export interface CveInfo {
  ids: string[]
  cvss: number | null
  affectedRanges: string[]
  patchedVersions: string[]
  /** La version du projet est-elle concernée ? null = inconnu (saisie manuelle, RSS). */
  affectsProject: boolean | null
}

export interface ArticleAlert {
  state: AlertState
  sentAt: string | null
  lastError: string | null
}

export interface Article {
  id: string
  title: string
  summary: string
  /** Markdown brut (saisie admin, notes de release GitHub, détails OSV). */
  content: string
  url: string
  sourceName: string
  sourceType: SourceType
  externalId: string | null
  type: ArticleType
  severity: Severity | null
  isCritical: boolean
  technologies: string[]
  tags: string[]
  version: string | null
  cve: CveInfo | null
  status: ArticleStatus
  /** Calculé : visible sur le site public (publié ET rattaché à au moins une technologie publique). */
  listed: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
  alert: ArticleAlert
}

/** Version allégée renvoyée par le fil d'actualités (sans le contenu complet). */
export type ArticleListItem = Omit<Article, 'content' | 'externalId'>

export interface ArticleDetail extends Article {
  contentHtml: string
}

export interface ArticlePage {
  items: ArticleListItem[]
  nextCursor: string | null
}

export interface Subscriber {
  id: string
  email: string
  name: string
  active: boolean
  /** Slugs des technologies suivies ; vide = toutes. */
  technologies: string[]
  createdAt: string
}

export interface AlertSettings {
  enabled: boolean
  /** Gravité minimale déclenchant un e-mail. */
  minSeverity: Severity
  /** Pour les failles importées automatiquement : n'alerter que si la version du projet est touchée. */
  onlyAffectingProject: boolean
  /** Les failles importées plus anciennes que ce nombre de jours ne déclenchent pas d'alerte. */
  maxAgeDays: number
}

export interface AlertLog {
  id: string
  articleId: string
  articleTitle: string
  severity: Severity | null
  technologies: string[]
  recipients: string[]
  status: 'sent' | 'failed'
  providerMessageId: string | null
  error: string | null
  trigger: 'manual' | 'ingest' | 'retry' | 'test'
  createdAt: string
}

export interface IngestSourceStat {
  technology: string
  source: 'github' | 'osv' | 'rss'
  created: number
  updated: number
  error: string | null
}

export interface IngestRun {
  id: string
  trigger: 'cron' | 'admin'
  startedAt: string
  finishedAt: string
  technologiesProcessed: string[]
  created: number
  updated: number
  alertsSent: number
  errors: number
  stats: IngestSourceStat[]
}
