import type { ArticleType, CveInfo, Severity, SourceType } from '../../../shared/types/veille'

/** Article candidat produit par un analyseur de source, avant écriture en base. */
export interface IngestedItem {
  /** Libellé stable servant à construire l'identifiant du document (ne doit pas changer d'un import à l'autre). */
  idLabel: string
  externalId: string
  title: string
  summary: string
  content: string
  url: string
  sourceName: string
  sourceType: Exclude<SourceType, 'manual'>
  type: ArticleType
  severity: Severity | null
  tags: string[]
  version: string | null
  cve: CveInfo | null
  publishedAt: string
  /** Date servant de curseur (dernière modification côté source). */
  cursorDate: string
}
