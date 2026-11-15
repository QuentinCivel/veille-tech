import { z } from 'zod'
import { analyzePackageJson } from '../../../lib/package-analyzer'

// Analyse d'un package.json collé dans l'admin : une proposition de fiche par dépendance,
// enrichie avec les métadonnées du registre npm (description, site, dépôt GitHub).
export default defineAdminHandler(async (event) => {
  const { packageJson } = await readValidatedBody(event, z.object({ packageJson: z.string().min(2).max(200_000) }).parse)
  let parsed: unknown
  try {
    parsed = JSON.parse(packageJson)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'JSON invalide' })
  }
  const proposals = await analyzePackageJson(parsed)
  const existing = new Set((await listTechnologies()).map(tech => tech.slug))
  return proposals.map(proposal => ({ ...proposal, exists: existing.has(proposal.slug) }))
})
