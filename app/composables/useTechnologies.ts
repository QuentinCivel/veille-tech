// Liste des technologies suivies, partagée entre composants (une seule requête grâce à la clé).
export function useTechnologies() {
  const { data, status, error } = useFetch<PublicTechnology[]>('/api/technologies', {
    key: 'technologies',
    default: () => [],
    dedupe: 'defer'
  })
  const bySlug = computed(() => Object.fromEntries((data.value ?? []).map(tech => [tech.slug, tech])))
  const nameOf = (slug: string) => bySlug.value[slug]?.name ?? slug
  return { technologies: data, bySlug, nameOf, status, error }
}
