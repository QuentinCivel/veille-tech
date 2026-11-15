<script setup lang="ts">
defineProps<{ type: ArticleType }>()

const classes: Record<ArticleType, string> = {
  update: 'badge-primary badge-soft',
  security: 'badge-error badge-soft',
  tutorial: 'badge-success badge-soft',
  // badge-ghost plutôt que neutral : ce dernier est quasi invisible sur les cartes en thème sombre.
  news: 'badge-ghost'
}
</script>

<template>
  <span class="badge badge-sm" :class="classes[type]">{{ TYPE_LABELS[type] }}</span>
</template>
