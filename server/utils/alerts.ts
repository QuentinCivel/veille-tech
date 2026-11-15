import { FieldValue, Timestamp } from 'firebase-admin/firestore'

// Service d'alerte e-mail. Point d'entrée unique, appelé :
//  - après création / modification d'un article dans l'admin (trigger "manual") ;
//  - par la collecte automatique quand une faille est importée (trigger "ingest") ;
//  - par la collecte, pour retenter les alertes en échec (trigger "retry").

const SENDING_LOCK_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

export async function getAlertSettings(): Promise<AlertSettings> {
  const snapshot = await useFirestore().collection(COLLECTIONS.settings).doc('alerts').get()
  const parsed = alertSettingsSchema.safeParse({ ...DEFAULT_ALERT_SETTINGS, ...snapshot.data() })
  return parsed.success ? parsed.data : DEFAULT_ALERT_SETTINGS
}

export type DispatchResult =
  | { status: 'sent', recipients: number }
  | { status: 'skipped', reason: string }
  | { status: 'failed', reason: string }

export async function dispatchSecurityAlert(
  articleId: string,
  trigger: AlertTrigger,
  options: { force?: boolean } = {}
): Promise<DispatchResult> {
  const db = useFirestore()
  const articleRef = db.collection(COLLECTIONS.articles).doc(articleId)
  // Resend pas encore configuré : l'alerte est ignorée (pas un échec, donc ni relance ni bruit dans le journal).
  // L'article reste à l'état "none" : il pourra être envoyé plus tard depuis l'admin (« Envoyer l'alerte »).
  const { resendApiKey, alertFromEmail } = useRuntimeConfig()
  if (!resendApiKey || !alertFromEmail) return { status: 'skipped', reason: 'E-mails non configurés (NUXT_RESEND_API_KEY / NUXT_ALERT_FROM_EMAIL)' }

  const settings = await getAlertSettings()

  // 1. Verrou transactionnel : garantit qu'une même alerte n'est envoyée qu'une fois,
  //    même si l'admin et la collecte la déclenchent en même temps.
  const lock = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(articleRef)
    if (!snapshot.exists) return { ok: false as const, reason: 'Article introuvable' }
    const article = snapshotToArticle(snapshot)

    const eligibility = alertEligibility(article, options.force ? { ...settings, maxAgeDays: 36500 } : settings)
    if (!eligibility.eligible) return { ok: false as const, reason: eligibility.reason }

    const lockedAt = snapshot.get('alert.lockedAt') as Timestamp | undefined
    if (article.alert.state === 'sending' && lockedAt && Date.now() - lockedAt.toMillis() < SENDING_LOCK_MS) {
      return { ok: false as const, reason: 'Envoi déjà en cours' }
    }
    if (article.alert.state === 'sent' && !options.force) return { ok: false as const, reason: 'Alerte déjà envoyée' }
    const attempts = Number(snapshot.get('alert.attempts') ?? 0)
    if (trigger === 'retry' && attempts >= MAX_ATTEMPTS) return { ok: false as const, reason: 'Nombre maximal de tentatives atteint' }

    tx.update(articleRef, {
      'alert.state': 'sending',
      'alert.lockedAt': FieldValue.serverTimestamp(),
      // Un renvoi manuel remet le compteur à zéro.
      'alert.attempts': trigger === 'retry' ? FieldValue.increment(1) : 1
    })
    return { ok: true as const, article }
  })
  if (!lock.ok) return { status: 'skipped', reason: lock.reason }
  const { article } = lock

  // 2. Destinataires actifs intéressés par au moins une des technologies concernées.
  const subscribersSnapshot = await db.collection(COLLECTIONS.subscribers).where('active', '==', true).get()
  const recipients = subscribersSnapshot.docs
    .map(doc => serializeDoc<Omit<Subscriber, 'id'>>(doc.data()))
    .filter(subscriber => subscriberWantsArticle(subscriber.technologies ?? [], article.technologies))
    .map(subscriber => subscriber.email)

  const techNames = (await getTechIndex()).names
  const articleUrl = `${useRuntimeConfig().public.siteUrl.replace(/\/$/, '')}/articles/${article.id}`
  const content = securityAlertEmail(article, techNames, articleUrl)

  try {
    if (!recipients.length) throw new Error('Aucun destinataire actif pour ces technologies')

    // Clé stable : un nouvel essai après une coupure réseau ne double pas l'envoi chez Resend.
    // Un renvoi forcé par l'admin utilise une nouvelle clé.
    const idempotencyKey = options.force ? `alert-${article.id}-${Date.now()}` : `alert-${article.id}`
    const messageIds = await sendEmails(recipients.map(to => ({ to, ...content })), idempotencyKey)

    await articleRef.update({
      'alert.state': 'sent',
      'alert.sentAt': FieldValue.serverTimestamp(),
      'alert.lastError': null,
      'alert.lockedAt': FieldValue.delete()
    })
    await logAlert(article, recipients, trigger, { status: 'sent', providerMessageId: messageIds[0] ?? null, error: null })
    return { status: 'sent', recipients: recipients.length }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await articleRef.update({
      'alert.state': 'failed',
      'alert.lastError': message.slice(0, 500),
      'alert.lockedAt': FieldValue.delete()
    })
    await logAlert(article, recipients, trigger, { status: 'failed', providerMessageId: null, error: message.slice(0, 500) })
    return { status: 'failed', reason: message }
  }
}

async function logAlert(
  article: Article,
  recipients: string[],
  trigger: AlertLog['trigger'],
  result: Pick<AlertLog, 'status' | 'providerMessageId' | 'error'>
) {
  await useFirestore().collection(COLLECTIONS.alerts).add({
    articleId: article.id,
    articleTitle: article.title,
    severity: article.severity,
    technologies: article.technologies,
    recipients,
    trigger,
    ...result,
    createdAt: FieldValue.serverTimestamp()
  })
}

/** Relance les alertes en échec ou bloquées (appelée à chaque collecte). */
export async function retryFailedAlerts(max = 5): Promise<number> {
  const snapshot = await useFirestore().collection(COLLECTIONS.articles)
    .where('alert.state', 'in', ['failed', 'sending'])
    .limit(max * 4)
    .get()
  const candidates = snapshot.docs.filter(doc => Number(doc.get('alert.attempts') ?? 0) < MAX_ATTEMPTS).slice(0, max)
  let sent = 0
  for (const doc of candidates) {
    const result = await dispatchSecurityAlert(doc.id, 'retry')
    if (result.status === 'sent') sent++
  }
  return sent
}

/** E-mail de test depuis l'admin pour valider la configuration Resend. */
export async function sendTestEmail(to: string): Promise<void> {
  const fakeArticle: Article = {
    id: 'test',
    title: 'Ceci est un e-mail de test',
    summary: 'Si vous lisez ce message, la configuration Resend de Veille Tech fonctionne.',
    content: '',
    url: '',
    sourceName: 'Veille Tech',
    sourceType: 'manual',
    externalId: null,
    type: 'security',
    severity: 'critical',
    isCritical: true,
    technologies: ['test'],
    tags: [],
    version: null,
    cve: { ids: ['CVE-0000-0000'], cvss: 10, affectedRanges: ['< 1.0.0'], patchedVersions: ['1.0.0'], affectsProject: true },
    status: 'published',
    listed: false,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    alert: { state: 'none', sentAt: null, lastError: null }
  }
  const siteUrl = useRuntimeConfig().public.siteUrl
  const content = securityAlertEmail(fakeArticle, { test: 'Test' }, siteUrl)
  await sendEmails([{ to, ...content, subject: `[TEST] ${content.subject}` }], `test-${Date.now()}`)
}
