// Message lisible à partir d'une erreur $fetch / h3 (statusMessage, erreurs de validation zod…).
export function apiErrorMessage(error: unknown): string {
  const err = error as {
    data?: { statusMessage?: string, message?: string, data?: { issues?: Array<{ message: string, path?: unknown[] }> } }
    statusMessage?: string
    message?: string
  }
  const issues = err.data?.data?.issues
  if (issues?.length) return issues.map(issue => `${issue.path?.join('.') || 'champ'} : ${issue.message}`).join(' · ')
  return err.data?.statusMessage || err.data?.message || err.statusMessage || err.message || 'Erreur inattendue'
}
