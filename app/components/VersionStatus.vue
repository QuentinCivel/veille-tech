<script setup lang="ts">
// Dernière version publiée. Dans l'admin locale uniquement, elle est comparée à la version du projet
// (l'API publique ne fournit jamais projectVersion).
const props = defineProps<{ tech: { projectVersion?: string, latestVersion: string | null } }>()

const gap = computed(() => versionGap(props.tech.projectVersion ?? '', props.tech.latestVersion))
const status = computed(() => {
  if (!props.tech.projectVersion || !props.tech.latestVersion) return null
  switch (gap.value) {
    case 'major': return { class: 'badge-error', label: 'Version majeure disponible' }
    case 'minor': return { class: 'badge-warning', label: 'Version mineure disponible' }
    case 'patch': return { class: 'badge-info', label: 'Correctif disponible' }
    default: return { class: 'badge-success', label: 'À jour' }
  }
})
</script>

<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
    <template v-if="tech.projectVersion">
      <dt class="text-base-content/60">Projet</dt>
      <dd class="font-mono">{{ tech.projectVersion }}</dd>
    </template>
    <template v-if="tech.latestVersion">
      <dt class="text-base-content/60">Dernière</dt>
      <dd class="font-mono">{{ tech.latestVersion }}</dd>
    </template>
    <template v-if="status">
      <dt class="sr-only">Statut</dt>
      <dd class="col-span-2"><span class="badge badge-sm h-auto py-0.5 leading-tight" :class="status.class">{{ status.label }}</span></dd>
    </template>
  </dl>
</template>
