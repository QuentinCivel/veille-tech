// Requêtes sortantes vers des sources externes : délai maximal, taille maximale, protocole http(s) uniquement.

export interface FetchOptions {
  timeoutMs?: number
  maxBytes?: number
  headers?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: string
}

// GitHub refuse les requêtes sans User-Agent.
const USER_AGENT = 'VeilleTech/1.0'

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  // Délai court : la collecte doit tenir dans la limite d'exécution d'une fonction Netlify (10 s).
  const { timeoutMs = 4500, maxBytes = 5_000_000, headers = {}, method = 'GET', body } = options
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`Protocole refusé : ${parsed.protocol}`)

  const response = await fetch(parsed, {
    method,
    body,
    headers: { 'User-Agent': USER_AGENT, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${parsed.host}${parsed.pathname}`)

  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error(`Réponse trop volumineuse (${declared} octets)`)
  const text = await response.text()
  if (text.length > maxBytes) throw new Error('Réponse trop volumineuse')
  return text
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, { ...options, headers: { Accept: 'application/json', ...options.headers } })
  return JSON.parse(text) as T
}
