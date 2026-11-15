import { Resend } from 'resend'

let client: Resend | undefined

function useResend(): Resend {
  if (client) return client
  const { resendApiKey } = useRuntimeConfig()
  if (!resendApiKey) throw new Error('NUXT_RESEND_API_KEY manquant : envoi d\'e-mail impossible')
  return (client = new Resend(resendApiKey))
}

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Envoi groupé : un e-mail individuel par destinataire (les adresses ne sont pas exposées entre elles),
 * en une seule requête API. La clé d'idempotence empêche un double envoi en cas de nouvelle tentative.
 */
export async function sendEmails(emails: OutgoingEmail[], idempotencyKey: string): Promise<string[]> {
  if (!emails.length) return []
  const { alertFromEmail } = useRuntimeConfig()
  if (!alertFromEmail) throw new Error('NUXT_ALERT_FROM_EMAIL manquant')

  const ids: string[] = []
  // L'API batch de Resend accepte 100 e-mails par appel.
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100)
    const { data, error } = await useResend().batch.send(
      chunk.map(email => ({ from: alertFromEmail, ...email })),
      { idempotencyKey: `${idempotencyKey}-${i / 100}` }
    )
    if (error) throw new Error(`Resend : ${error.message}`)
    ids.push(...(data?.data ?? []).map(item => item.id))
  }
  return ids
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SEVERITY_COLORS: Record<Severity, string> = {
  low: '#2563eb',
  moderate: '#ca8a04',
  high: '#ea580c',
  critical: '#dc2626'
}

/** Gabarit HTML (styles inline, compatibles clients mail) + version texte. */
export function securityAlertEmail(article: Article, techNames: Record<string, string>, articleUrl: string) {
  const severity = article.severity ?? 'critical'
  const severityLabel = SEVERITY_LABELS[severity]
  const technologies = article.technologies.map(slug => techNames[slug] ?? slug).join(', ')
  const cveIds = article.cve?.ids.join(', ') ?? ''
  const subject = `[${severityLabel.toUpperCase()}] ${technologies} — ${article.title}`.slice(0, 200)

  const rows: Array<[string, string]> = [
    ['Technologies', technologies],
    ['Gravité', `${severityLabel}${article.cve?.cvss != null ? ` (CVSS ${article.cve.cvss})` : ''}`]
  ]
  if (cveIds) rows.push(['Identifiants', cveIds])
  if (article.cve?.affectedRanges.length) rows.push(['Versions touchées', article.cve.affectedRanges.join(' ; ')])
  if (article.cve?.patchedVersions.length) rows.push(['Corrigé en', article.cve.patchedVersions.join(', ')])
  if (article.cve?.affectsProject != null) {
    rows.push(['Version du projet', article.cve.affectsProject ? 'CONCERNÉE — mise à jour requise' : 'Non concernée'])
  }

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr><td style="background:${SEVERITY_COLORS[severity]};color:#ffffff;padding:16px 24px;font-size:14px;font-weight:bold;letter-spacing:.5px">
      ⚠ ALERTE SÉCURITÉ — ${escapeHtml(severityLabel.toUpperCase())}
    </td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(article.title)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#3f3f46">${escapeHtml(article.summary)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse">
        ${rows.map(([label, value]) => `<tr>
          <td style="padding:6px 12px 6px 0;color:#71717a;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`).join('')}
      </table>
      <p style="margin:24px 0 0">
        <a href="${escapeHtml(articleUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Voir la fiche de veille</a>
        ${article.url ? `&nbsp;<a href="${escapeHtml(article.url)}" style="color:#2563eb">Source officielle</a>` : ''}
      </p>
    </td></tr>
    <tr><td style="padding:16px 24px;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7">
      Vous recevez cet e-mail en tant qu'administrateur de Veille Tech. Les destinataires se gèrent dans l'administration.
    </td></tr>
  </table>
</body></html>`

  const text = [
    `ALERTE SÉCURITÉ — ${severityLabel.toUpperCase()}`,
    '',
    article.title,
    article.summary,
    '',
    ...rows.map(([label, value]) => `${label} : ${value}`),
    '',
    `Fiche de veille : ${articleUrl}`,
    article.url ? `Source officielle : ${article.url}` : ''
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n')

  return { subject, html, text }
}
