import { z } from 'zod'

// Liste admin : brouillons inclus, filtre de statut facultatif.
const adminQuerySchema = feedQuerySchema.extend({ status: z.enum(['draft', 'published']).optional() })

export default defineAdminHandler(async (event) => {
  const query = await getValidatedQuery(event, adminQuerySchema.parse)
  return queryArticles(query)
})
