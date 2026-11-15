import { describe, expect, it } from 'vitest'
import {
  buildSearchTokens, isCriticalArticle, isListedArticle, isPrereleaseVersion, releaseLevel, slugify, tokenize, versionGap
} from '../../shared/utils/veille'
import { alertEligibility, subscriberWantsArticle } from '../../shared/utils/alerting'
import { articleInputSchema, DEFAULT_ALERT_SETTINGS } from '../../shared/utils/schemas'

describe('texte et recherche', () => {
  it('slugify retire accents et ponctuation', () => {
    expect(slugify('Sécurité : faille critique dans Nuxt 4.6 !')).toBe('securite-faille-critique-dans-nuxt-4-6')
  })

  it('tokenize conserve versions, CVE et paquets composés, sans mots vides', () => {
    expect(tokenize('Faille CVE-2026-1234 dans vue-router 5.4.0')).toEqual(['faille', 'cve-2026-1234', 'vue-router', '5.4.0'])
  })

  it('buildSearchTokens ajoute les préfixes des mots du titre', () => {
    const tokens = buildSearchTokens({ title: 'Vulnerability', body: [], exact: ['nuxt'] })
    expect(tokens).toContain('vul')
    expect(tokens).toContain('vulnerab')
    expect(tokens).toContain('vulnerability')
    expect(tokens).toContain('nuxt')
  })
})

describe('visibilité publique (technologies privées)', () => {
  const publicSlugs = new Set(['nuxt', 'vue'])

  it('un article publié lié à une technologie publique est listé', () => {
    expect(isListedArticle('published', ['nuxt'], publicSlugs)).toBe(true)
    expect(isListedArticle('published', ['mysql2', 'vue'], publicSlugs)).toBe(true)
  })

  it('masqué si brouillon, uniquement privé ou rattaché à une technologie supprimée', () => {
    expect(isListedArticle('draft', ['nuxt'], publicSlugs)).toBe(false)
    expect(isListedArticle('published', ['mysql2'], publicSlugs)).toBe(false)
    expect(isListedArticle('published', [], publicSlugs)).toBe(false)
  })
})

describe('versions', () => {
  it('releaseLevel', () => {
    expect(releaseLevel('v4.0.0')).toBe('major')
    expect(releaseLevel('4.6.0')).toBe('minor')
    expect(releaseLevel('4.6.1')).toBe('patch')
    expect(releaseLevel('vscode-typescript/v1.0.1')).toBeNull()
  })

  it('isPrereleaseVersion', () => {
    expect(isPrereleaseVersion('3.6.0-rc.11')).toBe(true)
    expect(isPrereleaseVersion('3.6.0')).toBe(false)
  })

  it('versionGap compare la plage du projet à la dernière version', () => {
    expect(versionGap('^4.4.8', '4.6.1')).toBe('minor')
    expect(versionGap('^3.5.0', '4.0.0')).toBe('major')
    expect(versionGap('^4.6.1', '4.6.1')).toBeNull()
    expect(versionGap('', '1.0.0')).toBeNull()
  })
})

describe('règle d\'alerte', () => {
  const base = {
    status: 'published' as const,
    type: 'security' as const,
    severity: 'critical' as const,
    publishedAt: new Date().toISOString(),
    sourceType: 'manual' as const,
    cve: null
  }

  it('alerte sur une faille critique publiée', () => {
    expect(alertEligibility(base, DEFAULT_ALERT_SETTINGS).eligible).toBe(true)
    expect(isCriticalArticle('security', 'critical')).toBe(true)
  })

  it('pas d\'alerte pour un brouillon, une gravité insuffisante ou des alertes désactivées', () => {
    expect(alertEligibility({ ...base, status: 'draft' }, DEFAULT_ALERT_SETTINGS).eligible).toBe(false)
    expect(alertEligibility({ ...base, severity: 'high' }, DEFAULT_ALERT_SETTINGS).eligible).toBe(false)
    expect(alertEligibility({ ...base, severity: 'high' }, { ...DEFAULT_ALERT_SETTINGS, minSeverity: 'high' }).eligible).toBe(true)
    expect(alertEligibility(base, { ...DEFAULT_ALERT_SETTINGS, enabled: false }).eligible).toBe(false)
  })

  it('ignore les vieilles failles importées mais pas les saisies manuelles', () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString()
    expect(alertEligibility({ ...base, sourceType: 'osv', publishedAt: old }, DEFAULT_ALERT_SETTINGS).eligible).toBe(false)
    expect(alertEligibility({ ...base, publishedAt: old }, DEFAULT_ALERT_SETTINGS).eligible).toBe(true)
  })

  it('option "seulement si la version du projet est concernée"', () => {
    const settings = { ...DEFAULT_ALERT_SETTINGS, onlyAffectingProject: true }
    const cve = { ids: [], cvss: null, affectedRanges: [], patchedVersions: [] }
    expect(alertEligibility({ ...base, sourceType: 'osv', cve: { ...cve, affectsProject: false } }, settings).eligible).toBe(false)
    expect(alertEligibility({ ...base, sourceType: 'osv', cve: { ...cve, affectsProject: true } }, settings).eligible).toBe(true)
  })

  it('filtre des destinataires par technologie', () => {
    expect(subscriberWantsArticle([], ['nuxt'])).toBe(true)
    expect(subscriberWantsArticle(['vue'], ['nuxt', 'vue'])).toBe(true)
    expect(subscriberWantsArticle(['firebase'], ['nuxt'])).toBe(false)
  })
})

describe('validation des articles', () => {
  const valid = { title: 'Faille critique', type: 'security', severity: 'critical', technologies: ['nuxt'], status: 'published' }

  it('accepte un article valide et normalise les identifiants', () => {
    const parsed = articleInputSchema.parse({ ...valid, cveIds: ['cve-2026-0001', 'ghsa-48HR-524c-v5w3'] })
    expect(parsed.cveIds).toEqual(['CVE-2026-0001', 'GHSA-48hr-524c-v5w3'])
  })

  it('refuse une gravité hors sécurité et une URL non http', () => {
    expect(articleInputSchema.safeParse({ ...valid, type: 'news' }).success).toBe(false)
    expect(articleInputSchema.safeParse({ ...valid, url: 'javascript:alert(1)' }).success).toBe(false)
  })
})
