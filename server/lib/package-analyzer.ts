import type { TechCategory } from '../../shared/types/veille'
import type { TechnologyInput } from '../../shared/utils/schemas'
import { slugify } from '../../shared/utils/veille'
import { DEFAULT_TECHNOLOGIES } from '../data/default-technologies'
import { fetchJson } from './http'

// Analyse d'un package.json : chaque dépendance devient une proposition de technologie à suivre.

export interface TechnologyProposal extends TechnologyInput {
  dependencyType: 'dependencies' | 'devDependencies'
}

interface NpmManifest {
  description?: string
  homepage?: string
  repository?: string | { url?: string, directory?: string }
}

const MAX_DEPENDENCIES = 60

const CATEGORY_HINTS: Array<[RegExp, TechCategory]> = [
  [/(^|[-/])(vitest|jest|cypress|playwright|mocha|chai|testing-library|start-server-and-test)/, 'testing'],
  [/^(typescript|@babel\/)/, 'language'],
  [/(tailwind|daisyui|sass|postcss|css|icon|ui)/, 'ui'],
  [/(mysql|pg|postgres|mongo|redis|sqlite|prisma|drizzle|knex|sequelize|firestore)/, 'database'],
  [/(auth|bcrypt|jwt|jose|passport|oauth)/, 'auth'],
  [/(mail|resend|sendgrid|mailgun)/, 'email'],
  [/(firebase|supabase|nitro|h3|express|fastify|hono)/, 'backend'],
  [/^(nuxt|vue|vue-router|react|svelte|next)$|^@nuxt\//, 'framework']
]

export function guessCategory(packageName: string, dependencyType: TechnologyProposal['dependencyType']): TechCategory {
  for (const [pattern, category] of CATEGORY_HINTS) if (pattern.test(packageName)) return category
  return dependencyType === 'devDependencies' ? 'tooling' : 'framework'
}

/** "git+https://github.com/nuxt/nuxt.git" -> "nuxt/nuxt" */
export function githubRepoFromUrl(url: string | undefined): string {
  const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[#/].*)?$/i.exec(url ?? '')
  return match ? `${match[1]}/${match[2]}` : ''
}

function dependencyEntries(pkg: unknown): Array<[string, string, TechnologyProposal['dependencyType']]> {
  if (!pkg || typeof pkg !== 'object') throw new Error('package.json invalide')
  const entries: Array<[string, string, TechnologyProposal['dependencyType']]> = []
  for (const dependencyType of ['dependencies', 'devDependencies'] as const) {
    const deps = (pkg as Record<string, unknown>)[dependencyType]
    if (!deps || typeof deps !== 'object') continue
    for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
      // Les paquets de types (@types/x) suivent leur bibliothèque : inutile de les surveiller séparément.
      if (name.startsWith('@types/') || typeof range !== 'string') continue
      entries.push([name, range, dependencyType])
    }
  }
  return entries.slice(0, MAX_DEPENDENCIES)
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

export async function analyzePackageJson(pkg: unknown): Promise<TechnologyProposal[]> {
  const entries = dependencyEntries(pkg)

  return mapWithConcurrency(entries, 6, async ([name, range, dependencyType]): Promise<TechnologyProposal> => {
    // Fiche par défaut connue (flux RSS, préfixe de tag…) : plus riche que ce que le registre npm fournit.
    const known = DEFAULT_TECHNOLOGIES.find(tech => tech.npmPackage === name)
    if (known) return { ...known, projectVersion: range, origin: 'project', dependencyType }

    const manifest = await fetchJson<NpmManifest>(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`)
      .catch((): NpmManifest => ({}))
    const repositoryUrl = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
    const inMonorepo = typeof manifest.repository === 'object' && Boolean(manifest.repository?.directory)
    const website = manifest.homepage && /^https?:\/\//.test(manifest.homepage) ? manifest.homepage.slice(0, 2000) : ''

    return {
      slug: slugify(name.replace(/^@/, '').replace('/', '-'), 60),
      name,
      category: guessCategory(name, dependencyType),
      origin: 'project',
      description: (manifest.description ?? '').slice(0, 300),
      website,
      npmPackage: name,
      githubRepo: githubRepoFromUrl(repositoryUrl),
      // Dans un monorepo, les tags sont généralement de la forme "paquet@1.2.3".
      tagPrefix: inMonorepo ? `${name}@` : '',
      releaseMinLevel: dependencyType === 'devDependencies' ? 'minor' : 'patch',
      rssFeeds: [],
      projectVersion: range,
      tracked: true,
      private: false,
      order: dependencyType === 'dependencies' ? 100 : 150,
      dependencyType
    }
  })
}
