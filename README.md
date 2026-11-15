# Veille Tech

Veille technologique : mises à jour, failles de sécurité (alerte e-mail immédiate si
critique), tutoriels et actualités. Nuxt 4 SSR · Tailwind + daisyUI · Firestore · Resend · Netlify.

Architecture, modèle de données et stratégie d'alerte : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Principe : site public en lecture seule, administration en local

- **En ligne** (Netlify) : le fil de veille est public, sans inscription. La collecte automatique et les
  alertes e-mail tournent seules. **L'administration n'existe pas** : les pages `/admin` sont retirées du
  build et les routes `/api/admin/**` répondent 404.
- **En local** (`npm run dev`) : l'administration est accessible sur http://localhost:3000/admin, sans compte,
  uniquement depuis votre machine. Elle écrit dans la même base Firestore que le site en ligne.
  ⚠️ Ne lancez jamais le serveur de dev avec `--host` (il serait alors joignable depuis le réseau).

## Prérequis

- Node.js **22.21+** (ou 24.11+ / 26+)
- Un projet Firebase (offre Spark gratuite suffisante) : seul **Firestore** est utilisé
- Un compte Resend (gratuit)

## Mise en route

1. **Installer** : `npm install`
2. **Firebase** ([console.firebase.google.com](https://console.firebase.google.com)) :
   - créer le projet (sans Google Analytics, offre Spark) ;
   - **Bases de données et stockage › Firestore** › *Créer une base de données* : édition Standard,
     ID `(default)`, emplacement `eur3 (europe)`, mode production ; pas de sauvegardes planifiées ;
   - ⚙️ **Paramètres du projet** › *Comptes de service* › *Générer une nouvelle clé privée* → valeurs
     `NUXT_FIREBASE_*` (puis supprimer le fichier JSON téléchargé).
3. **Resend** : créer une clé API, et vérifier un domaine pour l'expéditeur (sinon `onboarding@resend.dev`
   n'envoie qu'à l'adresse du compte Resend).
4. **Configurer** : copier `.env.example` en `.env` et le remplir.
5. **Règles et index Firestore** :
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore --project <id-du-projet>
   ```
   (La création des index prend quelques minutes.)
6. **Lancer** : `npm run dev` → http://localhost:3000/admin
   - *Technologies* › **Initialiser les technologies par défaut** ;
   - *Alertes e-mail* › ajouter les destinataires, puis **Envoyer un e-mail de test** ;
   - *Tableau de bord* › **Lancer une collecte** (à répéter : chaque passage traite quelques technologies).

## Déploiement Netlify

1. Pousser le dépôt et l'importer dans Netlify (Nuxt est détecté automatiquement).
2. *Site configuration › Environment variables* : reprendre toutes les variables de `.env`
   (`NUXT_PUBLIC_SITE_URL` = URL du site, et un `NUXT_CRON_SECRET` aléatoire de 32 caractères minimum).
3. La fonction `netlify/functions/ingest-cron.mts` lance la collecte toutes les 30 minutes.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement + administration locale |
| `npm run build` / `npm run preview` | Build de production (sans administration) / prévisualisation |
| `npm test` | Tests unitaires (Vitest) |
| `npm run typecheck` | Vérification TypeScript (serveur + app) |

## Notes de sécurité

- Firestore est fermé à tout accès direct (`firestore.rules`) : seul le serveur y accède, avec le compte de service.
- `npm audit` signale encore `braces` et `node-forge`, sans correctif publié : dépendances d'outillage (build,
  serveur de dev HTTPS), absentes du code exécuté en production.
- `simple-git` et `@grpc/grpc-js` sont forcés en versions corrigées (`overrides`) ; Nuxt DevTools est donc désactivé.
- TypeScript 6 est utilisé (et non 7) car `vue-tsc` n'est pas encore compatible avec le compilateur natif de TS 7.
