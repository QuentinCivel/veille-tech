/** Copie d'une ref mise à jour seulement après `delayMs` sans changement (ex. champ de recherche). */
export function useDebounced<T>(source: Ref<T>, delayMs = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => (debounced.value = value), delayMs)
  })
  onScopeDispose(() => clearTimeout(timer))
  return debounced
}
