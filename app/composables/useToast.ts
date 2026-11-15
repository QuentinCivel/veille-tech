export interface Toast {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

let counter = 0

// Notifications éphémères de l'administration (affichées par le layout admin, annoncées via aria-live).
export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function push(type: Toast['type'], message: string, durationMs = 5000) {
    const id = ++counter
    toasts.value.push({ id, type, message })
    setTimeout(() => dismiss(id), durationMs)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 8000),
    info: (message: string) => push('info', message),
    warning: (message: string) => push('warning', message, 8000)
  }
}

/** Message de retour après un déclenchement d'alerte côté serveur. */
export function describeDispatch(result: { status: string, recipients?: number, reason?: string } | null): { type: Toast['type'], message: string } | null {
  if (!result) return null
  if (result.status === 'sent') return { type: 'success', message: `Alerte e-mail envoyée à ${result.recipients} destinataire(s).` }
  if (result.status === 'failed') return { type: 'error', message: `Échec de l'alerte e-mail : ${result.reason}` }
  return { type: 'info', message: `Pas d'alerte e-mail : ${result.reason}` }
}
