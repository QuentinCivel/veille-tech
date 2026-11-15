import type { AlertSettings, Article } from '../types/veille'
import { severityRank } from './veille'

export type AlertTrigger = 'manual' | 'ingest' | 'retry'

/**
 * Règle métier unique décidant si un article déclenche un e-mail d'alerte.
 * Fonction pure (sans accès BDD) pour pouvoir être testée unitairement.
 */
export function alertEligibility(
  article: Pick<Article, 'status' | 'type' | 'severity' | 'publishedAt' | 'sourceType' | 'cve'>,
  settings: AlertSettings,
  now = new Date()
): { eligible: true } | { eligible: false, reason: string } {
  if (!settings.enabled) return { eligible: false, reason: 'Alertes désactivées dans les réglages' }
  if (article.status !== 'published') return { eligible: false, reason: 'Article non publié' }
  if (article.type !== 'security') return { eligible: false, reason: 'Article hors sécurité' }
  if (severityRank(article.severity) < severityRank(settings.minSeverity)) {
    return { eligible: false, reason: `Gravité inférieure au seuil (${settings.minSeverity})` }
  }

  // Garde-fous réservés aux imports automatiques : pas d'avalanche d'e-mails pour un historique de failles.
  if (article.sourceType !== 'manual') {
    const ageDays = (now.getTime() - new Date(article.publishedAt).getTime()) / 86_400_000
    if (ageDays > settings.maxAgeDays) {
      return { eligible: false, reason: `Faille publiée il y a plus de ${settings.maxAgeDays} jours` }
    }
    if (settings.onlyAffectingProject && article.cve?.affectsProject === false) {
      return { eligible: false, reason: 'La version du projet n\'est pas concernée' }
    }
  }
  return { eligible: true }
}

/** Un destinataire reçoit l'alerte s'il suit au moins une technologie de l'article (liste vide = toutes). */
export function subscriberWantsArticle(subscriberTechs: string[], articleTechs: string[]): boolean {
  return subscriberTechs.length === 0 || articleTechs.some(slug => subscriberTechs.includes(slug))
}
