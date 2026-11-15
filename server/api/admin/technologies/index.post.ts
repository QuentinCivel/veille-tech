export default defineAdminHandler(async (event) => {
  const input = await readValidatedBody(event, technologyInputSchema.parse)
  try {
    await saveTechnology(input, 'create')
  }
  catch (error) {
    if (isAlreadyExists(error)) throw createError({ statusCode: 409, statusMessage: `La technologie « ${input.slug} » existe déjà` })
    throw error
  }
  setResponseStatus(event, 201)
  return { slug: input.slug }
})
