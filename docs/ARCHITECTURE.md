# Veille Tech — Architecture

Application de veille technologique : nouvelles versions, failles de sécurité, tutoriels et actualités
des technologies suivies, avec alerte e-mail immédiate en cas de faille critique.

**Choix retenus** : Nuxt 4 (SSR) · Tailwind CSS 4 + daisyUI 5 · Cloud Firestore (offre **Spark**, sans Cloud
Functions) · Resend (e-mails) · Netlify (hébergement + tâche planifiée).

**Accès** : site public en lecture seule, sans inscription. **Pas de comptes utilisateurs** : l'administration
(saisie manuelle, technologies, destinataires) n'existe qu'en développement, sur la machine locale, et elle est
absente du build de production.

**Confidentialité du projet suivi** : rien sur le site public ne permet d'identifier le projet surveillé ni ses
versions. La version utilisée par le projet (`projectVersion`), l'origine des technologies et l'impact d'une faille
sur le projet (`cve.affectsProject`) restent en base, réservés à l'admin locale et aux e-mails d'alerte ;
l'API publique les retire (`publicTechnology`, `publicArticle`).

**Technologies privées** : une technologie marquée « privée » dans l'admin est collectée normalement (articles,
alertes e-mail) mais n'existe pas pour le site public : absente des listes et filtres, page en 404, articles masqués,
retirée des articles rattachés à plusieurs technologies, filtre `?tech=` sur son slug toujours vide.

---

## 1. Technologies suivies et catégories

La liste de départ ([server/data/default-technologies.ts](../server/data/default-technologies.ts)) couvre
22 technologies, chargées depuis l'admin. D'autres s'ajoutent à la main ou en important un `package.json`
(admin › Technologies › *Importer*) : chaque dépendance devient une proposition enrichie par le registre npm.
La version utilisée par le projet se renseigne dans l'admin ; elle n'est jamais versionnée dans le code.

| Groupe | Technologies | Sources de veille |
|---|---|---|
| Frameworks et bibliothèques | Nuxt, Vue.js, Vue Router, nuxt-auth-utils, bcrypt.js, MySQL2, Nodemailer | GitHub Releases, OSV, blogs RSS |
| Langage et tests | TypeScript, Vitest, Cypress, start-server-and-test | GitHub Releases, OSV, blogs RSS |
| Runtime, serveur et services | Node.js, Nitro, h3, Vite, MySQL, Netlify | GitHub, OSV, flux RSS (dont *Vulnerability Reports* de Node.js) |
| Outils de l'application de veille | Firebase, Firebase Admin, Tailwind CSS, daisyUI, Resend | GitHub, OSV, blogs RSS |

**Catégories** : Framework, Interface/CSS, Runtime, Langage, Backend/BaaS, Base de données, Authentification,
E-mail, Tests, Outillage, Hébergement.
**Types de contenu** : Mise à jour · Sécurité/Faille · Tutoriel · Actualité.
**Tags automatiques** (publics) : `release`, `version-majeure` / `version-mineure` / `correctif`,
`correctif-securite`, `cve`, `cwe-xx`, + catégories des flux RSS.

---

## 2. Modèle de données Firestore

Toutes les lectures/écritures passent par le serveur (SDK Admin) ; les règles interdisent tout accès direct.

### `technologies/{slug}`
```ts
{
  name: 'Nuxt', category: 'framework', origin: 'project' | 'implicit' | 'tooling-app' | 'manual',
  description, website,
  npmPackage: 'nuxt',            // → OSV (failles) + registre npm (dernière version)
  githubRepo: 'nuxt/nuxt',       // → GitHub Releases
  tagPrefix: '',                 // monorepo : 'firebase@'
  releaseMinLevel: 'patch' | 'minor' | 'major',
  rssFeeds: [{ url, defaultType: 'news' | 'security' | … }],
  projectVersion: '^1.2.3',      // admin uniquement, jamais exposé par l'API publique
  latestVersion: '4.6.4',
  tracked: true,                 // collecte automatique active
  private: false,                // true = suivie en privé : absente du site public (elle et ses articles)
  order: 10, createdAt, updatedAt,
  ingest: {                      // état interne, jamais exposé
    lastRunAt, lastError,
    github: '<ISO>', osv: '<ISO>', rss: { '<hash url>': '<ISO>' }   // curseurs
  }
}
```

### `articles/{id}` — id lisible et stable : `slug-titre-<hash8>`
```ts
{
  title, summary, content /* Markdown */, url, sourceName,
  sourceType: 'manual' | 'github-release' | 'osv' | 'rss',
  externalId: 'osv:GHSA-…' | 'github:nuxt/nuxt:v4.6.1' | 'rss:<hash>' | null,   // déduplication
  type: 'update' | 'security' | 'tutorial' | 'news',
  severity: 'low' | 'moderate' | 'high' | 'critical' | null,
  isCritical: boolean,           // dénormalisé : type === 'security' && severity === 'critical'
  listed: boolean,               // dénormalisé : publié ET rattaché à au moins une technologie publique
  technologies: ['nuxt'], tags: ['cve'], version: 'v4.6.1' | null,
  cve: { ids, cvss, affectedRanges, patchedVersions, affectsProject } | null,
  status: 'draft' | 'published',
  publishedAt, createdAt, updatedAt,  // Timestamp
  searchTokens: string[],        // mots normalisés + préfixes du titre (recherche)
  alert: { state: 'none' | 'sending' | 'sent' | 'failed', sentAt, lastError, lockedAt, attempts }
}
```

### `subscribers/{autoId}` — destinataires des alertes (admins uniquement)
`{ email, name, active, technologies: [] /* vide = toutes */, createdAt }`

### `alerts/{autoId}` — journal des envois
`{ articleId, articleTitle, severity, technologies, recipients, status: 'sent'|'failed', providerMessageId, error, trigger: 'manual'|'ingest'|'retry', createdAt }`

### `settings/alerts`
`{ enabled: true, minSeverity: 'critical', onlyAffectingProject: false, maxAgeDays: 14 }`

### `ingestRuns/{autoId}` — historique des collectes (purgé après 30 jours)
`{ trigger: 'cron'|'admin', startedAt, finishedAt, technologiesProcessed, created, updated, alertsSent, errors, stats[] }`

**Recherche** : Firestore n'a pas de plein texte. On stocke `searchTokens` et on filtre par `array-contains`.
Une requête ne peut contenir qu'un seul `array-contains` : il porte sur le critère le plus sélectif
(recherche › technologie › tag), les autres sont appliqués en mémoire par lots bornés.
Le site public filtre sur `listed == true` (jamais sur `status`), ce qui exclut d'emblée les brouillons et les
articles des technologies privées ; `listed` est recalculé à chaque enregistrement et, pour tous les articles
concernés, quand une technologie change de visibilité ou est supprimée (`refreshListing`).
Les 23 index composites nécessaires sont dans [firestore.indexes.json](../firestore.indexes.json).

---

## 3. Arborescence

```text
veille-tech/
├── app/
│   ├── app.vue · error.vue
│   ├── assets/css/main.css            # Tailwind 4 + daisyUI (thèmes clair/sombre)
│   ├── layouts/default.vue · admin.vue
│   ├── middleware/admin.ts            # /admin → 404 hors développement (la sécurité est côté API)
│   ├── composables/                   # useArticleFeed, useTechnologies, useToast, useDebounced
│   ├── components/
│   │   ├── ArticleCard.vue            # carte daisyUI, mise en valeur des failles critiques
│   │   ├── ArticleFeed.vue            # filtres (URL) + liste + pagination
│   │   ├── CriticalBanner.vue · SeverityBadge.vue · TypeBadge.vue · VersionStatus.vue · ThemeToggle.vue
│   │   └── admin/ArticleForm.vue · TechnologyForm.vue
│   └── pages/
│       ├── index.vue · articles/[id].vue · technologies/index.vue · technologies/[slug].vue
│       └── admin/index.vue · articles/{index,new,[id]}.vue · technologies.vue · alerts.vue  # retirées du build de prod
├── shared/                            # partagé client + serveur (auto-importé)
│   ├── types/veille.ts
│   └── utils/veille.ts · schemas.ts (zod) · alerting.ts (règle d'alerte)
├── server/
│   ├── api/
│   │   ├── articles/ · technologies/  # public (cache CDN court)
│   │   ├── admin/**                   # dev + local uniquement (middleware + defineAdminHandler), 404 en prod
│   │   └── cron/ingest.post.ts        # appelé par la tâche planifiée (jeton Bearer)
│   ├── middleware/admin.ts · csrf.ts
│   ├── utils/                         # firebase, local-admin, articles, technologies, alerts, email, ingest, markdown, cache
│   ├── lib/                           # code pur testable : http, local-admin, package-analyzer, ingest/{github,osv,rss}
│   └── data/default-technologies.ts
├── netlify/functions/ingest-cron.mts  # Scheduled Function (*/30 min)
├── tests/unit/                        # Vitest (31 tests)
├── firestore.rules · firestore.indexes.json · firebase.json · netlify.toml · .env.example
```

---

## 4. Stratégie d'alerte e-mail et d'automatisation

### Options comparées

| Approche | Avantages | Inconvénients |
|---|---|---|
| Trigger Firestore (`onDocumentCreated`) en Cloud Function | Se déclenche quelle que soit l'origine de l'écriture | **Offre Blaze obligatoire** ; un second projet à déployer |
| Extension « Trigger Email » | Peu de code | Blaze + SMTP ; peu de contrôle (idempotence, filtrage) |
| **Service applicatif appelé après chaque écriture (retenu)** | Fonctionne en **Spark** ; une seule base de code ; logique testable | Il faut l'appeler à chaque point d'écriture (2 ici : admin et collecte) |

### Fonctionnement retenu

```
Admin (POST/PUT article) ──┐
                           ├─▶ dispatchSecurityAlert(articleId)
Collecte (nouvelle faille) ┘        │
                                    ├─ 1. Transaction Firestore : relit l'article, applique la règle
                                    │     alertEligibility() et pose un verrou alert.state = 'sending'
                                    │     → impossible d'envoyer deux fois, même en concurrence
                                    ├─ 2. Destinataires actifs suivant au moins une techno de l'article
                                    ├─ 3. Resend batch (1 e-mail individuel par admin) + Idempotency-Key
                                    └─ 4. alert.state = 'sent' | 'failed' + journal dans `alerts`

Collecte suivante ─▶ retryFailedAlerts() : relance les échecs (5 tentatives maximum)
```

**Règle d'éligibilité** ([shared/utils/alerting.ts](../shared/utils/alerting.ts), testée) : alertes activées,
article publié, type sécurité, gravité ≥ seuil (critique par défaut). Pour les imports automatiques, deux
garde-fous en plus : pas d'alerte pour une faille de plus de 14 jours (premier import = historique complet),
et optionnellement seulement si la version du projet est concernée (deuxième requête OSV avec la version).

**Collecte automatique** : Netlify Scheduled Function toutes les 30 min → `POST /api/cron/ingest` (secret
comparé à temps constant). Pour tenir dans les 10 s d'une fonction Netlify : budget de temps, rotation (les
technologies les moins récemment collectées passent d'abord), délais réseau de 4,5 s, et **curseurs** par
source pour ne réécrire que les nouveautés (quota Spark : 50 000 lectures et 20 000 écritures par jour).

| Source | API | Type produit |
|---|---|---|
| GitHub Releases | `GET /repos/{repo}/releases` (+ `GITHUB_TOKEN` optionnel) | Mise à jour (filtrée par niveau semver, sans pré-versions) |
| OSV.dev | `POST /v1/query` (npm) | Sécurité : gravité GHSA ou score CVSS 3.1 calculé, plages touchées/corrigées |
| Flux RSS/Atom | blogs officiels | Actualité / Tutoriel / Sécurité (classement par mots-clés ou type du flux) |
| Registre npm | `GET /{paquet}/latest` | `latestVersion` de la technologie |

### Sécurité
- Firestore verrouillé (`allow read, write: if false`) ; le serveur utilise le SDK Admin.
- Administration **sans comptes, locale uniquement** :
  - en production, `import.meta.dev` vaut `false` : les routes `/api/admin/**` répondent 404 et les pages
    `/admin` sont retirées du build (module inline de `nuxt.config.ts`) ; il n'y a donc rien à attaquer ;
  - en développement, seules les requêtes de la machine locale passent : adresse de loopback (socket ou
    `X-Forwarded-For` posé par le relais du serveur de dev) **et** en-tête `Host` local (contre le DNS rebinding) ;
  - double contrôle (middleware serveur + `defineAdminHandler`) ; vérification de l'en-tête `Origin` sur toute
    requête modifiant des données (CSRF : un site visité pendant `npm run dev` ne peut pas piloter l'admin).
- Validation zod de toutes les entrées ; contenu externe converti puis **assaini** (sanitize-html) avant `v-html`.
- Requêtes sortantes limitées en durée et en taille, http(s) uniquement ; fast-xml-parser ne résout pas les entités externes (pas de XXE).
- En-têtes : HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP `frame-ancestors`.

---

## 5. Exemples de code clés

- Envoi d'alerte : [server/utils/alerts.ts](../server/utils/alerts.ts) (`dispatchSecurityAlert`) et gabarit
  e-mail [server/utils/email.ts](../server/utils/email.ts), appelés par
  [server/api/admin/articles/index.post.ts](../server/api/admin/articles/index.post.ts) et la collecte
  [server/utils/ingest.ts](../server/utils/ingest.ts).
- Carte d'actualité daisyUI : [app/components/ArticleCard.vue](../app/components/ArticleCard.vue) — bandeau
  rouge « Faille critique » + CVSS, bordure épaisse, badge « Votre version est concernée » ; information
  portée par le texte et l'icône (pas seulement la couleur), lien étiré accessible.
