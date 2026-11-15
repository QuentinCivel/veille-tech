import type { Severity, Technology } from '../../../shared/types/veille'
import { summarize } from '../../utils/markdown'
import { fetchJson } from '../http'
import type { IngestedItem } from './types'

// OSV.dev agrège les bases GitHub Advisory (GHSA), NVD, etc. — API publique, sans clé.
// Doc : https://google.github.io/osv.dev/post-v1-query/

interface OsvEvent { introduced?: string, fixed?: string, last_affected?: string }

export interface OsvVuln {
  id: string
  summary?: string
  details?: string
  aliases?: string[]
  published?: string
  modified: string
  withdrawn?: string
  affected?: Array<{
    package?: { name: string, ecosystem: string }
    ranges?: Array<{ type: string, events: OsvEvent[] }>
  }>
  severity?: Array<{ type: string, score: string }>
  database_specific?: { severity?: string, cwe_ids?: string[] }
  references?: Array<{ type: string, url: string }>
}

const OSV_SEVERITY: Record<string, Severity> = {
  LOW: 'low',
  MODERATE: 'moderate',
  MEDIUM: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical'
}

// ---------- Score CVSS v3.x (formule officielle FIRST) ----------
const CVSS3_WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 }
} as const

function roundUp(value: number): number {
  const integer = Math.round(value * 100_000)
  return integer % 10_000 === 0 ? integer / 100_000 : (Math.floor(integer / 10_000) + 1) / 10
}

/** "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" -> 9.8 ; null si le vecteur n'est pas du CVSS 3. */
export function cvss3BaseScore(vector: string): number | null {
  if (!/^CVSS:3\.[01]\//.test(vector)) return null
  const metrics = Object.fromEntries(vector.split('/').slice(1).map(part => part.split(':') as [string, string]))
  const { AV, AC, PR, UI, S, C, I, A } = metrics
  const av = CVSS3_WEIGHTS.AV[AV as keyof typeof CVSS3_WEIGHTS.AV]
  const ac = CVSS3_WEIGHTS.AC[AC as keyof typeof CVSS3_WEIGHTS.AC]
  const ui = CVSS3_WEIGHTS.UI[UI as keyof typeof CVSS3_WEIGHTS.UI]
  const [c, i, a] = [C, I, A].map(value => CVSS3_WEIGHTS.CIA[value as keyof typeof CVSS3_WEIGHTS.CIA])
  const changed = S === 'C'
  const pr = PR === 'N' ? 0.85 : PR === 'L' ? (changed ? 0.68 : 0.62) : PR === 'H' ? (changed ? 0.5 : 0.27) : undefined
  if ([av, ac, ui, c, i, a, pr].some(value => value === undefined) || (S !== 'U' && S !== 'C')) return null

  const iss = 1 - (1 - c!) * (1 - i!) * (1 - a!)
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss
  const exploitability = 8.22 * av! * ac! * pr! * ui!
  if (impact <= 0) return 0
  return roundUp(Math.min((changed ? 1.08 : 1) * (impact + exploitability), 10))
}

export function severityFromScore(score: number): Severity | null {
  if (score >= 9) return 'critical'
  if (score >= 7) return 'high'
  if (score >= 4) return 'moderate'
  if (score > 0) return 'low'
  return null
}

/** Plages lisibles : [{introduced: "3.0.0"}, {fixed: "3.4.2"}] -> ">=3.0.0 <3.4.2". */
export function describeRanges(vuln: OsvVuln, packageName: string): { affected: string[], patched: string[] } {
  const affected: string[] = []
  const patched = new Set<string>()
  for (const entry of vuln.affected ?? []) {
    if (entry.package && entry.package.name !== packageName) continue
    for (const range of entry.ranges ?? []) {
      let lower: string | null = null
      for (const event of range.events) {
        if (event.introduced !== undefined) lower = event.introduced === '0' ? null : event.introduced
        if (event.fixed !== undefined || event.last_affected !== undefined) {
          const upper = event.fixed !== undefined ? `<${event.fixed}` : `<=${event.last_affected}`
          affected.push(lower ? `>=${lower} ${upper}` : upper)
          if (event.fixed) patched.add(event.fixed)
          lower = null
        }
      }
      if (lower !== null) affected.push(`>=${lower}`)
    }
  }
  return { affected: [...new Set(affected)], patched: [...patched] }
}

export function vulnSeverity(vuln: OsvVuln): { severity: Severity | null, cvss: number | null } {
  const vector = vuln.severity?.find(entry => entry.type === 'CVSS_V3')?.score
  const cvss = vector ? cvss3BaseScore(vector) : null
  const declared = OSV_SEVERITY[(vuln.database_specific?.severity ?? '').toUpperCase()]
  return { severity: declared ?? (cvss !== null ? severityFromScore(cvss) : null), cvss }
}

export function vulnToItem(
  vuln: OsvVuln,
  tech: Pick<Technology, 'name' | 'npmPackage'>,
  affectingProject: Set<string> | null
): IngestedItem | null {
  if (vuln.withdrawn) return null
  const { severity, cvss } = vulnSeverity(vuln)
  const { affected, patched } = describeRanges(vuln, tech.npmPackage)
  const ids = [vuln.id, ...(vuln.aliases ?? [])].filter(id => /^(CVE|GHSA)-/i.test(id))
  const affectsProject = affectingProject ? affectingProject.has(vuln.id) : null

  const rawSummary = vuln.summary?.trim() || `Vulnérabilité ${vuln.id}`
  const title = rawSummary.toLowerCase().includes(tech.name.toLowerCase()) ? rawSummary : `${tech.name} : ${rawSummary}`
  const references = (vuln.references ?? []).filter(ref => /^https?:\/\//.test(ref.url)).slice(0, 10)
  const content = [
    vuln.details?.slice(0, 40_000) ?? '',
    references.length ? `\n\n### Références\n\n${references.map(ref => `- [${ref.type}](${ref.url})`).join('\n')}` : ''
  ].join('')

  // Pas de tag "projet concerné" : les tags sont publics et indexés pour la recherche.
  // L'information reste dans cve.affectsProject, filtré par l'API publique (publicArticle).
  const tags = ['cve', ...(vuln.database_specific?.cwe_ids ?? []).map(cwe => cwe.toLowerCase())].slice(0, 6)

  return {
    idLabel: vuln.id,
    externalId: `osv:${vuln.id}`,
    title: title.slice(0, 200),
    summary: summarize(vuln.details ?? '') || rawSummary,
    content,
    url: vuln.id.startsWith('GHSA-') ? `https://github.com/advisories/${vuln.id}` : `https://osv.dev/vulnerability/${vuln.id}`,
    sourceName: 'OSV / GitHub Advisory',
    sourceType: 'osv',
    type: 'security',
    severity,
    tags,
    version: null,
    cve: { ids, cvss, affectedRanges: affected, patchedVersions: patched, affectsProject },
    publishedAt: vuln.published ?? vuln.modified,
    cursorDate: vuln.modified
  }
}

/** Version minimale déclarée dans le package.json : "^4.4.8" -> "4.4.8". */
export function minimalVersion(range: string): string | null {
  const match = /(\d+\.\d+\.\d+(?:-[\w.]+)?)/.exec(range)
  return match ? match[1]! : null
}

export async function queryOsv(packageName: string, version?: string | null): Promise<OsvVuln[]> {
  const body = JSON.stringify({ package: { name: packageName, ecosystem: 'npm' }, ...(version ? { version } : {}) })
  const result = await fetchJson<{ vulns?: OsvVuln[] }>('https://api.osv.dev/v1/query', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    maxBytes: 10_000_000
  })
  return result.vulns ?? []
}
