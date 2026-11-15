import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

// Le contenu vient de sources externes (notes de release GitHub, flux RSS, OSV) :
// il est converti en HTML puis assaini côté serveur avant tout affichage via v-html.

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img', 'h1', 'h2', 'del', 'details', 'summary', 'sup', 'sub', 'kbd'
  ],
  // Inclut les attributs ajoutés par transformTags ci-dessous.
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
    code: ['class'],
    th: ['align'],
    td: ['align']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow ugc', target: '_blank' }),
    img: sanitizeHtml.simpleTransform('img', { loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' })
  }
}

export function renderMarkdown(markdown: string): string {
  if (!markdown.trim()) return ''
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false })
  return sanitizeHtml(html, SANITIZE_OPTIONS)
}

/** Texte brut (sans balises) : pour les résumés et les e-mails. */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Résumé court à partir de Markdown : premier paragraphe utile, tronqué proprement. */
export function summarize(markdown: string, maxLength = 280): string {
  const text = stripHtml(marked.parse(markdown, { async: false }) as string)
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).trim()}…`
}
