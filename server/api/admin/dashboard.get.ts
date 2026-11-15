// Tableau de bord : compteurs, dernières collectes et dernières alertes.
// Les requêtes count() ne coûtent qu'une lecture par tranche de 1 000 documents.
export default defineAdminHandler(async () => {
  const db = useFirestore()
  const articles = db.collection(COLLECTIONS.articles)
  const [total, drafts, critical, failedAlerts, runs, alerts] = await Promise.all([
    articles.count().get(),
    articles.where('status', '==', 'draft').count().get(),
    articles.where('isCritical', '==', true).count().get(),
    articles.where('alert.state', '==', 'failed').count().get(),
    db.collection(COLLECTIONS.ingestRuns).orderBy('startedAt', 'desc').limit(10).get(),
    db.collection(COLLECTIONS.alerts).orderBy('createdAt', 'desc').limit(20).get()
  ])
  return {
    counts: {
      articles: total.data().count,
      drafts: drafts.data().count,
      critical: critical.data().count,
      failedAlerts: failedAlerts.data().count
    },
    runs: runs.docs.map(doc => ({ id: doc.id, ...serializeDoc<Omit<IngestRun, 'id'>>(doc.data()) })),
    alerts: alerts.docs.map(doc => ({ id: doc.id, ...serializeDoc<Omit<AlertLog, 'id'>>(doc.data()) }))
  }
})
