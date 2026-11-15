import { describe, expect, it } from 'vitest'
import { releaseToItem, versionFromTag } from '../../server/lib/ingest/github'
import { cvss3BaseScore, describeRanges, minimalVersion, vulnSeverity, vulnToItem, type OsvVuln } from '../../server/lib/ingest/osv'
import { classifyEntry, entryToItem, parseFeed } from '../../server/lib/ingest/rss'
import { githubRepoFromUrl, guessCategory } from '../../server/lib/package-analyzer'
import { renderMarkdown } from '../../server/utils/markdown'

describe('GitHub Releases', () => {
  const tech = { name: 'Firebase', slug: 'firebase', githubRepo: 'firebase/firebase-js-sdk', tagPrefix: 'firebase@', releaseMinLevel: 'minor' as const }
  const release = { tag_name: 'firebase@13.0.0', name: null, body: 'Fixes a **security** issue', html_url: 'https://github.com/x', published_at: '2026-10-01T00:00:00Z', draft: false, prerelease: false }

  it('extrait la version selon le préfixe de tag', () => {
    expect(versionFromTag('v4.6.1', '')).toBe('4.6.1')
    expect(versionFromTag('firebase@13.0.0', 'firebase@')).toBe('13.0.0')
    expect(versionFromTag('@firebase/app@1.0.0', 'firebase@')).toBeNull()
    expect(versionFromTag('vscode-typescript/v1.0.1', '')).toBeNull()
  })

  it('convertit une release en article et détecte les correctifs de sécurité', () => {
    const item = releaseToItem(release, tech)!
    expect(item.title).toBe('Firebase v13.0.0')
    expect(item.type).toBe('update')
    expect(item.tags).toEqual(['release', 'version-majeure', 'correctif-securite'])
    expect(item.externalId).toBe('github:firebase/firebase-js-sdk:firebase@13.0.0')
  })

  it('ignore les pré-versions et les patchs sous le niveau minimal', () => {
    expect(releaseToItem({ ...release, tag_name: 'firebase@13.0.1' }, tech)).toBeNull()
    expect(releaseToItem({ ...release, tag_name: 'firebase@13.1.0-rc.1' }, tech)).toBeNull()
    expect(releaseToItem({ ...release, prerelease: true }, tech)).toBeNull()
  })
})

describe('OSV / CVSS', () => {
  it('calcule le score CVSS 3.1 officiel', () => {
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(9.8)
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H')).toBe(10)
    expect(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N')).toBe(6.1)
    expect(cvss3BaseScore('CVSS:4.0/AV:N')).toBeNull()
  })

  const vuln: OsvVuln = {
    id: 'GHSA-aaaa-bbbb-cccc',
    summary: 'Remote code execution in island props',
    details: 'Un attaquant peut **exécuter** du code.',
    aliases: ['CVE-2026-1111'],
    published: '2026-10-05T00:00:00Z',
    modified: '2026-10-06T00:00:00Z',
    affected: [{
      package: { name: 'nuxt', ecosystem: 'npm' },
      ranges: [{ type: 'SEMVER', events: [{ introduced: '4.0.0' }, { fixed: '4.6.2' }, { introduced: '3.0.0' }, { fixed: '3.17.9' }] }]
    }],
    severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }],
    database_specific: { severity: 'CRITICAL', cwe_ids: ['CWE-94'] },
    references: [{ type: 'ADVISORY', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }]
  }

  it('décrit les plages de versions touchées et corrigées', () => {
    expect(describeRanges(vuln, 'nuxt')).toEqual({ affected: ['>=4.0.0 <4.6.2', '>=3.0.0 <3.17.9'], patched: ['4.6.2', '3.17.9'] })
  })

  it('déduit la gravité (déclarée, sinon via CVSS)', () => {
    expect(vulnSeverity(vuln)).toEqual({ severity: 'critical', cvss: 9.8 })
    expect(vulnSeverity({ ...vuln, database_specific: {} }).severity).toBe('critical')
  })

  it('convertit une faille en article de sécurité', () => {
    const item = vulnToItem(vuln, { name: 'Nuxt', npmPackage: 'nuxt' }, new Set(['GHSA-aaaa-bbbb-cccc']))!
    expect(item.title).toBe('Nuxt : Remote code execution in island props')
    expect(item.type).toBe('security')
    expect(item.severity).toBe('critical')
    expect(item.cve).toMatchObject({ ids: ['GHSA-aaaa-bbbb-cccc', 'CVE-2026-1111'], affectsProject: true })
    // L'impact sur le projet n'apparaît jamais dans les tags (publics et indexés pour la recherche).
    expect(item.tags).toEqual(['cve', 'cwe-94'])
    expect(vulnToItem({ ...vuln, withdrawn: '2026-10-07T00:00:00Z' }, { name: 'Nuxt', npmPackage: 'nuxt' }, null)).toBeNull()
  })

  it('minimalVersion', () => {
    expect(minimalVersion('^4.4.8')).toBe('4.4.8')
    expect(minimalVersion('latest')).toBeNull()
  })
})

describe('Flux RSS / Atom', () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Nuxt Blog</title>
    <item><title>Nuxt 4.6 is out</title><link>https://nuxt.com/blog/v4-6</link><guid>v4-6</guid>
    <pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>New <b>features</b></p>]]></description>
    <category>Release</category></item>
    <item><title>Bad link</title><link>javascript:alert(1)</link></item>
    </channel></rss>`

  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title>
    <entry><title type="html">Getting started with &lt;b&gt;Vite&lt;/b&gt;</title><id>tag:1</id>
    <link rel="alternate" href="https://vite.dev/blog/start"/><updated>2026-10-01T00:00:00Z</updated>
    <summary>Guide</summary></entry></feed>`

  it('lit un flux RSS 2.0', () => {
    const feed = parseFeed(rss)
    expect(feed.title).toBe('Nuxt Blog')
    expect(feed.entries[0]).toMatchObject({ title: 'Nuxt 4.6 is out', link: 'https://nuxt.com/blog/v4-6', categories: ['Release'] })
    expect(feed.entries[0]!.date).toBe('2026-10-05T10:00:00.000Z')
  })

  it('lit un flux Atom', () => {
    const feed = parseFeed(atom)
    expect(feed.entries[0]).toMatchObject({ title: 'Getting started with Vite', link: 'https://vite.dev/blog/start' })
  })

  it('classe les entrées et rejette les liens non http', () => {
    const feedConfig = { url: 'https://nuxt.com/blog/rss.xml', defaultType: 'news' as const }
    const [good, bad] = parseFeed(rss).entries
    expect(entryToItem(good!, feedConfig, 'Nuxt Blog')).toMatchObject({ type: 'news', summary: 'New features', tags: ['release'] })
    expect(entryToItem(bad!, feedConfig, 'Nuxt Blog')).toBeNull()
    expect(classifyEntry({ title: 'Getting started with Vite', categories: [] }, 'news')).toBe('tutorial')
    expect(classifyEntry({ title: 'Security release: CVE-2026-0001', categories: [] }, 'news')).toBe('security')
    expect(classifyEntry({ title: 'Anything', categories: [] }, 'security')).toBe('security')
  })
})

describe('Analyse de package.json', () => {
  it('extrait owner/repo des URL de dépôt npm', () => {
    expect(githubRepoFromUrl('git+https://github.com/nuxt/nuxt.git')).toBe('nuxt/nuxt')
    expect(githubRepoFromUrl('git@github.com:vuejs/core.git')).toBe('vuejs/core')
    expect(githubRepoFromUrl('https://gitlab.com/x/y')).toBe('')
  })

  it('devine la catégorie', () => {
    expect(guessCategory('cypress', 'devDependencies')).toBe('testing')
    expect(guessCategory('mysql2', 'dependencies')).toBe('database')
    expect(guessCategory('bcryptjs', 'dependencies')).toBe('auth')
    expect(guessCategory('lodash', 'dependencies')).toBe('framework')
  })
})

describe('Rendu Markdown assaini', () => {
  it('supprime scripts et gestionnaires d\'événements, sécurise les liens', () => {
    const html = renderMarkdown('[lien](https://a.dev) <script>alert(1)</script> <img src="https://x/y.png" onerror="alert(1)"> [x](javascript:alert(1))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"')
    expect(html).toContain('loading="lazy"')
  })
})
