import tailwindcss from '@tailwindcss/vite'

// En-têtes de sécurité appliqués à toutes les réponses.
// Pas de CSP "script-src" stricte : Nuxt SSR injecte des scripts inline (payload),
// on se limite aux directives sans risque de casse.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'"
}

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  // DevTools désactivés : ils dépendent de simple-git 3.x (failles connues, cf. "overrides" du package.json).
  devtools: { enabled: false },
  ssr: true,

  modules: [
    // Administration locale uniquement : les pages /admin sont retirées du build de production.
    // (Les routes /api/admin répondent 404 hors développement, voir server/utils/local-admin.ts.)
    (_options, nuxt) => {
      if (nuxt.options.dev) return
      // Sans cette règle, le serveur rend /admin lui-même et renvoie un vrai statut HTTP 404.
      delete nuxt.options.routeRules?.['/admin/**']
      nuxt.hook('pages:extend', (pages) => {
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i]!.path.startsWith('/admin')) pages.splice(i, 1)
        }
      })
    }
  ],

  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    // Pré-bundlé en dev (utilisé par les formulaires de l'admin) : évite un rechargement de page.
    optimizeDeps: { include: ['zod'] }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s · Veille Tech',
      meta: [
        { name: 'description', content: 'Veille technologique : mises à jour, failles de sécurité, tutoriels et actualités de la stack.' },
        { name: 'theme-color', content: '#1d232a' }
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },

  runtimeConfig: {
    // Secrets serveur — surchargés par les variables NUXT_* (voir .env.example)
    firebaseProjectId: '',
    firebaseClientEmail: '',
    firebasePrivateKey: '',
    resendApiKey: '',
    alertFromEmail: '',
    cronSecret: '',
    githubToken: '',
    public: {
      siteUrl: 'http://localhost:3000'
    }
  },

  routeRules: {
    '/**': { headers: securityHeaders },
    // Administration (développement uniquement) : rendue côté client et jamais indexée
    '/admin/**': { ssr: false, headers: { ...securityHeaders, 'X-Robots-Tag': 'noindex, nofollow' } },
    // Par défaut aucune réponse d'API n'est mise en cache ; les routes publiques posent leur propre
    // cache CDN uniquement en cas de succès (voir publicCache dans server/utils/cache.ts).
    '/api/**': { headers: { ...securityHeaders, 'Cache-Control': 'no-store' } }
  },

  typescript: {
    strict: true
  }
})
