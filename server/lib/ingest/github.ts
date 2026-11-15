import type { Technology } from '../../../shared/types/veille'
import { isPrereleaseVersion, RELEASE_LEVELS, releaseLevel } from '../../../shared/utils/veille'
import { summarize } from '../../utils/markdown'
import { fetchJson } from '../http'
import type { IngestedItem } from './types'

export interface GithubRelease {
  tag_name: string
  name: string | null
  body: string | null
  html_url: string
  published_at: string | null
  draft: boolean
  prerelease: boolean
}

const LEVEL_TAGS = { major: 'version-majeure', minor: 'version-mineure', patch: 'correctif' } as const
const SECURITY_HINT = /\b(security|vulnerabilit(y|ies)|CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)\b/i

type TechForRelease = Pick<Technology, 'name' | 'slug' | 'githubRepo' | 'tagPrefix' | 'releaseMinLevel'>

/** Version extraite du tag ("firebase@13.0.0" -> "13.0.0", "v4.6.1" -> "4.6.1"), ou null si le tag est à ignorer. */
export function versionFromTag(tag: string, tagPrefix: string): string | null {
  let version = tag.trim()
  if (tagPrefix) {
    if (!version.startsWith(tagPrefix)) return null
    version = version.slice(tagPrefix.length)
  }
  version = version.replace(/^v/, '')
  return /^\d+\.\d+\.\d+/.test(version) ? version : null
}

export function releaseToItem(release: GithubRelease, tech: TechForRelease): IngestedItem | null {
  if (release.draft || release.prerelease || !release.published_at) return null
  const version = versionFromTag(release.tag_name, tech.tagPrefix)
  if (!version || isPrereleaseVersion(version)) return null

  const level = releaseLevel(version)
  if (!level || RELEASE_LEVELS.indexOf(level) < RELEASE_LEVELS.indexOf(tech.releaseMinLevel)) return null

  const body = (release.body ?? '').slice(0, 50_000)
  const tags: string[] = ['release', LEVEL_TAGS[level]]
  if (SECURITY_HINT.test(body)) tags.push('correctif-securite')

  const levelLabel = level === 'major' ? 'majeure' : level === 'minor' ? 'mineure' : 'corrective'
  const title = `${tech.name} v${version}`
  return {
    idLabel: `${tech.slug} v${version}`,
    externalId: `github:${tech.githubRepo.toLowerCase()}:${release.tag_name}`,
    title,
    summary: summarize(body) || `Nouvelle version ${levelLabel} de ${tech.name}.`,
    content: body,
    url: release.html_url,
    sourceName: 'GitHub Releases',
    sourceType: 'github-release',
    type: 'update',
    severity: null,
    tags,
    version: `v${version}`,
    cve: null,
    publishedAt: release.published_at,
    cursorDate: release.published_at
  }
}

export async function fetchGithubReleases(repo: string, token?: string): Promise<GithubRelease[]> {
  return fetchJson<GithubRelease[]>(`https://api.github.com/repos/${repo}/releases?per_page=20`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
}
