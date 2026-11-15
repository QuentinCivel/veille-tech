<script setup lang="ts">
const props = defineProps<{ severity: Severity, cvss?: number | null }>()

const classes: Record<Severity, string> = {
  low: 'badge-info',
  moderate: 'badge-warning',
  high: 'badge-warning badge-outline font-semibold',
  critical: 'badge-error font-bold'
}
// Le texte porte l'information (pas uniquement la couleur) : accessible aux daltoniens et lecteurs d'écran.
const label = computed(() => `Gravité ${SEVERITY_LABELS[props.severity].toLowerCase()}${props.cvss != null ? ` · CVSS ${props.cvss}` : ''}`)
</script>

<template>
  <span class="badge badge-sm gap-1" :class="classes[severity]">
    <svg v-if="severity === 'critical'" xmlns="http://www.w3.org/2000/svg" class="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clip-rule="evenodd" />
    </svg>
    {{ label }}
  </span>
</template>
