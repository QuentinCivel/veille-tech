// Fonctions pures partagées client / serveur (auto-importées par Nuxt depuis shared/utils).
import type { ArticleStatus, ArticleType, ReleaseLevel, Severity, TechCategory, TechOrigin } from '../types/veille'

export const ARTICLE_TYPES: ArticleType[] = ['update', 'security', 'tutorial', 'news']
export const SEVERITIES: Severity[] = ['low', 'moderate', 'high', 'critical']
export const RELEASE_LEVELS: ReleaseLevel[] = ['patch', 'minor', 'major']
export const TECH_CATEGORIES: TechCategory[] = [
  'framework', 'ui', 'runtime', 'language', 'backend', 'database', 'auth', 'email', 'testing', 'tooling', 'hosting'
]

export const TYPE_LABELS: Record<ArticleType, string> = {
  update: 'Mise à jour',
  security: 'Sécurité / Faille',
  tutorial: 'Tutoriel',
  news: 'Actualité'
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Faible',
  moderate: 'Modérée',
  high: 'Élevée',
  critical: 'Critique'
}

export const CATEGORY_LABELS: Record<TechCategory, string> = {
  framework: 'Framework',
  ui: 'Interface / CSS',
  runtime: 'Runtime',
  language: 'Langage',
  backend: 'Backend / BaaS',
  database: 'Base de données',
  auth: 'Authentification',
  email: 'E-mail',
  testing: 'Tests',
  tooling: 'Outillage',
  hosting: 'Hébergement'
}

export const ORIGIN_LABELS: Record<TechOrigin, string> = {
  project: 'package.json du projet',
  implicit: 'Dépendance implicite',
  'tooling-app': 'Outil de veille',
  manual: 'Ajout manuel'
}

export function severityRank(severity: Severity | null | undefined): number {
  return severity ? SEVERITIES.indexOf(severity) + 1 : 0
}

export function isCriticalArticle(type: ArticleType, severity: Severity | null): boolean {
  return type === 'security' && severity === 'critical'
}

/**
 * Un article est visible sur le site public s'il est publié et rattaché à au moins une technologie publique.
 * Un slug inconnu (technologie supprimée) ne compte pas comme public : en cas de doute, on masque.
 */
export function isListedArticle(status: ArticleStatus, technologies: string[], publicSlugs: ReadonlySet<string>): boolean {
  return status === 'published' && technologies.some(slug => publicSlugs.has(slug))
}

/** Supprime accents et majuscules : "Sécurité" -> "securite". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function slugify(text: string, maxLength = 80): string {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'en', 'au', 'aux', 'pour', 'par', 'sur', 'dans', 'avec',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'is', 'are', 'be', 'it', 'this', 'that', 'from'
])

/** Découpe un texte en mots normalisés ; conserve "4.4.8", "cve-2025-1234", "vue-router". */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9.@-]+/)
    .map(word => word.replace(/^[.@-]+|[.@-]+$/g, ''))
    .filter(word => word.length >= 2 && !STOP_WORDS.has(word))
}

/**
 * Jetons de recherche stockés sur chaque article (Firestore n'a pas de recherche plein texte).
 * Les mots du titre reçoivent aussi leurs préfixes (≥ 3 lettres) pour la recherche "en cours de frappe".
 */
export function buildSearchTokens(input: { title: string, body: string[], exact: string[] }, max = 300): string[] {
  const tokens = new Set<string>()
  for (const word of tokenize(input.title)) {
    tokens.add(word)
    for (let i = 3; i < word.length; i++) tokens.add(word.slice(0, i))
  }
  for (const value of input.exact) {
    const normalized = normalizeText(value).trim()
    if (normalized) tokens.add(normalized)
  }
  for (const text of input.body) {
    for (const word of tokenize(text)) {
      if (tokens.size >= max) break
      tokens.add(word)
    }
  }
  return [...tokens].slice(0, max)
}

/** Niveau d'une version semver : 1.0.0 -> major, 1.2.0 -> minor, 1.2.3 -> patch. */
export function releaseLevel(version: string): ReleaseLevel | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  if (!match) return null
  const [, , minor, patch] = match
  if (patch !== '0') return 'patch'
  return minor === '0' ? 'major' : 'minor'
}

/** Retard de version : compare la version du projet ("^4.4.8") à la dernière publiée ("4.6.1"). */
export function versionGap(projectRange: string, latest: string | null): ReleaseLevel | null {
  const current = /(\d+)\.(\d+)\.(\d+)/.exec(projectRange)
  const next = latest ? /(\d+)\.(\d+)\.(\d+)/.exec(latest) : null
  if (!current || !next) return null
  const [a, b] = [current.slice(1).map(Number), next.slice(1).map(Number)] as [number[], number[]]
  if (b[0]! > a[0]!) return 'major'
  if (b[0] === a[0] && b[1]! > a[1]!) return 'minor'
  if (b[0] === a[0] && b[1] === a[1] && b[2]! > a[2]!) return 'patch'
  return null
}

export function isPrereleaseVersion(version: string): boolean {
  return /^v?\d+\.\d+\.\d+-/.test(version.trim())
}

export function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Europe/Paris'
  }).format(date)
}

/** Lien externe sûr : uniquement http(s). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  }
  catch {
    return false
  }
}
