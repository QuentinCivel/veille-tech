import { z } from 'zod'
import type { AlertSettings } from '../types/veille'

// Schémas de validation : utilisés par les formulaires d'admin ET re-vérifiés côté serveur.

const httpUrl = z.url({ protocol: /^https?$/, message: 'URL http(s) invalide' }).max(2000)
const optionalHttpUrl = z.union([z.literal(''), httpUrl])
const slug = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug : minuscules, chiffres et tirets uniquement')

export const articleInputSchema = z.object({
  title: z.string().trim().min(3, 'Titre trop court').max(200),
  summary: z.string().trim().max(600).default(''),
  content: z.string().max(50_000).default(''),
  url: optionalHttpUrl.default(''),
  sourceName: z.string().trim().max(120).default(''),
  type: z.enum(['update', 'security', 'tutorial', 'news']),
  severity: z.enum(['low', 'moderate', 'high', 'critical']).nullable().default(null),
  technologies: z.array(slug).min(1, 'Choisir au moins une technologie').max(20),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
  version: z.string().trim().max(60).nullable().default(null),
  cveIds: z.array(
    z.string().trim()
      .regex(/^(CVE-\d{4}-\d{4,}|GHSA(-[a-z0-9]{4}){3})$/i, 'Identifiant CVE/GHSA invalide')
      // Formes canoniques : "CVE-2025-1234" et "GHSA-xxxx-xxxx-xxxx"
      .transform(id => /^cve/i.test(id) ? id.toUpperCase() : `GHSA${id.slice(4).toLowerCase()}`)
  ).max(20).default([]),
  cvss: z.number().min(0).max(10).nullable().default(null),
  status: z.enum(['draft', 'published']),
  publishedAt: z.iso.datetime({ offset: true }).optional()
}).refine(data => data.type === 'security' || data.severity === null, {
  message: 'La gravité ne concerne que les articles de sécurité',
  path: ['severity']
})
export type ArticleInput = z.infer<typeof articleInputSchema>

export const rssFeedSchema = z.object({
  url: httpUrl,
  defaultType: z.enum(['update', 'security', 'tutorial', 'news'])
})

export const technologyInputSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(60),
  category: z.enum(['framework', 'ui', 'runtime', 'language', 'backend', 'database', 'auth', 'email', 'testing', 'tooling', 'hosting']),
  origin: z.enum(['project', 'implicit', 'tooling-app', 'manual']).default('manual'),
  description: z.string().trim().max(300).default(''),
  website: optionalHttpUrl.default(''),
  npmPackage: z.string().trim().max(214).regex(/^$|^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, 'Nom de paquet npm invalide').default(''),
  githubRepo: z.string().trim().max(140).regex(/^$|^[\w.-]+\/[\w.-]+$/, 'Format attendu : owner/repo').default(''),
  tagPrefix: z.string().trim().max(60).default(''),
  releaseMinLevel: z.enum(['patch', 'minor', 'major']).default('patch'),
  rssFeeds: z.array(rssFeedSchema).max(5).default([]),
  projectVersion: z.string().trim().max(60).default(''),
  tracked: z.boolean().default(true),
  private: z.boolean().default(false),
  order: z.number().int().min(0).max(9999).default(100)
})
export type TechnologyInput = z.infer<typeof technologyInputSchema>

export const subscriberInputSchema = z.object({
  email: z.email('Adresse e-mail invalide').trim().toLowerCase().max(254),
  name: z.string().trim().max(80).default(''),
  active: z.boolean().default(true),
  technologies: z.array(slug).max(50).default([])
})
export type SubscriberInput = z.infer<typeof subscriberInputSchema>

export const alertSettingsSchema = z.object({
  enabled: z.boolean(),
  minSeverity: z.enum(['low', 'moderate', 'high', 'critical']),
  onlyAffectingProject: z.boolean(),
  maxAgeDays: z.number().int().min(1).max(365)
})

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  minSeverity: 'critical',
  onlyAffectingProject: false,
  maxAgeDays: 14
}

/** Paramètres de filtre du fil d'actualités (query string). */
export const feedQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tech: slug.optional(),
  type: z.enum(['update', 'security', 'tutorial', 'news']).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
  critical: z.enum(['1', 'true']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})
export type FeedQuery = z.infer<typeof feedQuerySchema>
