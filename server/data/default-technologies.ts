import type { TechnologyInput } from '../../shared/utils/schemas'

// Liste de départ des technologies suivies (modifiable ensuite dans l'admin locale).
// Aucune version de projet ici : ce fichier est versionné, la version utilisée se renseigne dans l'admin.
// Chargées depuis l'administration (bouton "Initialiser les technologies par défaut").

export const DEFAULT_TECHNOLOGIES: TechnologyInput[] = [
  // ---- Frameworks et bibliothèques ----
  {
    slug: 'nuxt', name: 'Nuxt', category: 'framework', origin: 'manual', order: 10,
    description: 'Framework Vue full-stack (SSR, routes serveur Nitro).',
    website: 'https://nuxt.com', npmPackage: 'nuxt', githubRepo: 'nuxt/nuxt', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [{ url: 'https://nuxt.com/blog/rss.xml', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'vue', name: 'Vue.js', category: 'framework', origin: 'manual', order: 20,
    description: 'Framework JavaScript progressif (API Composition, <script setup>).',
    website: 'https://vuejs.org', npmPackage: 'vue', githubRepo: 'vuejs/core', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [{ url: 'https://blog.vuejs.org/feed.rss', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'vue-router', name: 'Vue Router', category: 'framework', origin: 'manual', order: 30,
    description: 'Routeur officiel de Vue.js (utilisé par Nuxt).',
    website: 'https://router.vuejs.org', npmPackage: 'vue-router', githubRepo: 'vuejs/router', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'nuxt-auth-utils', name: 'nuxt-auth-utils', category: 'auth', origin: 'manual', order: 40,
    description: 'Module Nuxt de sessions scellées et d\'authentification.',
    website: 'https://github.com/atinux/nuxt-auth-utils', npmPackage: 'nuxt-auth-utils', githubRepo: 'atinux/nuxt-auth-utils', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'bcryptjs', name: 'bcrypt.js', category: 'auth', origin: 'manual', order: 50,
    description: 'Hachage de mots de passe bcrypt en JavaScript pur.',
    website: 'https://github.com/dcodeIO/bcrypt.js', npmPackage: 'bcryptjs', githubRepo: 'dcodeIO/bcrypt.js', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'mysql2', name: 'MySQL2', category: 'database', origin: 'manual', order: 60,
    description: 'Client MySQL pour Node.js (requêtes préparées, promesses).',
    website: 'https://sidorares.github.io/node-mysql2/docs', npmPackage: 'mysql2', githubRepo: 'sidorares/node-mysql2', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'nodemailer', name: 'Nodemailer', category: 'email', origin: 'manual', order: 70,
    description: 'Envoi d\'e-mails SMTP depuis Node.js.',
    website: 'https://nodemailer.com', npmPackage: 'nodemailer', githubRepo: 'nodemailer/nodemailer', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },

  // ---- Langage et tests ----
  {
    slug: 'typescript', name: 'TypeScript', category: 'language', origin: 'manual', order: 80,
    description: 'Sur-ensemble typé de JavaScript.',
    // "patch" : TypeScript publie ses versions stables en x.y.2 (x.y.0/x.y.1 = bêta/RC).
    website: 'https://www.typescriptlang.org', npmPackage: 'typescript', githubRepo: 'microsoft/TypeScript', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [{ url: 'https://devblogs.microsoft.com/typescript/feed/', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'vitest', name: 'Vitest', category: 'testing', origin: 'manual', order: 90,
    description: 'Framework de tests unitaires propulsé par Vite.',
    website: 'https://vitest.dev', npmPackage: 'vitest', githubRepo: 'vitest-dev/vitest', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'cypress', name: 'Cypress', category: 'testing', origin: 'manual', order: 100,
    description: 'Tests de bout en bout (E2E) dans le navigateur.',
    website: 'https://www.cypress.io', npmPackage: 'cypress', githubRepo: 'cypress-io/cypress', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [{ url: 'https://www.cypress.io/blog/rss.xml', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'start-server-and-test', name: 'start-server-and-test', category: 'testing', origin: 'manual', order: 110,
    description: 'Démarre le serveur, attend qu\'il réponde puis lance les tests E2E.',
    website: 'https://github.com/bahmutov/start-server-and-test', npmPackage: 'start-server-and-test', githubRepo: 'bahmutov/start-server-and-test', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },

  // ---- Runtime, serveur et services ----
  {
    slug: 'nodejs', name: 'Node.js', category: 'runtime', origin: 'manual', order: 200,
    description: 'Runtime JavaScript serveur (Nitro, outils de build).',
    website: 'https://nodejs.org', npmPackage: '', githubRepo: 'nodejs/node', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [
      { url: 'https://nodejs.org/en/feed/vulnerability.xml', defaultType: 'security' },
      { url: 'https://nodejs.org/en/feed/blog.xml', defaultType: 'news' }
    ],
    projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'nitro', name: 'Nitro', category: 'backend', origin: 'manual', order: 210,
    description: 'Moteur serveur de Nuxt (routes server/api, déploiement multi-hébergeurs).',
    website: 'https://nitro.build', npmPackage: 'nitropack', githubRepo: 'nitrojs/nitro', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'h3', name: 'h3', category: 'backend', origin: 'manual', order: 220,
    description: 'Framework HTTP minimaliste utilisé par Nitro (defineEventHandler, cookies…).',
    website: 'https://h3.dev', npmPackage: 'h3', githubRepo: 'h3js/h3', tagPrefix: '', releaseMinLevel: 'patch',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'vite', name: 'Vite', category: 'tooling', origin: 'manual', order: 230,
    description: 'Outil de build et serveur de développement utilisé par Nuxt.',
    website: 'https://vite.dev', npmPackage: 'vite', githubRepo: 'vitejs/vite', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [{ url: 'https://vite.dev/blog.rss', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'mysql', name: 'MySQL', category: 'database', origin: 'manual', order: 240,
    description: 'Système de gestion de base de données relationnelle. Veille manuelle.',
    website: 'https://dev.mysql.com', npmPackage: '', githubRepo: '', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'netlify', name: 'Netlify', category: 'hosting', origin: 'manual', order: 250,
    description: 'Plateforme d\'hébergement et de déploiement (sites, SSR, fonctions serverless).',
    website: 'https://www.netlify.com', npmPackage: '', githubRepo: '', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [{ url: 'https://www.netlify.com/changelog/feed.xml', defaultType: 'update' }], projectVersion: '', tracked: true, private: false
  },

  // ---- Outils de l'application de veille ----
  {
    slug: 'firebase', name: 'Firebase', category: 'backend', origin: 'tooling-app', order: 300,
    // Plateforme suivie via son blog ; le SDK utilisé (serveur) est suivi par la fiche "firebase-admin".
    description: 'Plateforme Google : Cloud Firestore (base de données de l\'outil de veille).',
    website: 'https://firebase.google.com', npmPackage: '', githubRepo: '', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [{ url: 'https://firebase.blog/rss.xml', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'firebase-admin', name: 'Firebase Admin SDK', category: 'backend', origin: 'tooling-app', order: 310,
    description: 'SDK serveur Firebase (accès à Cloud Firestore).',
    website: 'https://firebase.google.com/docs/admin/setup', npmPackage: 'firebase-admin', githubRepo: 'firebase/firebase-admin-node', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'tailwindcss', name: 'Tailwind CSS', category: 'ui', origin: 'tooling-app', order: 320,
    description: 'Framework CSS utilitaire.',
    website: 'https://tailwindcss.com', npmPackage: 'tailwindcss', githubRepo: 'tailwindlabs/tailwindcss', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [{ url: 'https://tailwindcss.com/feeds/feed.xml', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'daisyui', name: 'daisyUI', category: 'ui', origin: 'tooling-app', order: 330,
    description: 'Bibliothèque de composants pour Tailwind CSS.',
    website: 'https://daisyui.com', npmPackage: 'daisyui', githubRepo: 'saadeghi/daisyui', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [{ url: 'https://daisyui.com/blog/rss.xml', defaultType: 'news' }], projectVersion: '', tracked: true, private: false
  },
  {
    slug: 'resend', name: 'Resend', category: 'email', origin: 'tooling-app', order: 340,
    description: 'API d\'envoi d\'e-mails transactionnels (alertes de sécurité).',
    website: 'https://resend.com', npmPackage: 'resend', githubRepo: 'resend/resend-node', tagPrefix: '', releaseMinLevel: 'minor',
    rssFeeds: [{ url: 'https://resend.com/changelog/rss.xml', defaultType: 'update' }], projectVersion: '', tracked: true, private: false
  }
]
