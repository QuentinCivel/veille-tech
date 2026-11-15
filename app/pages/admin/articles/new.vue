<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Nouvel article' })
</script>

<template>
  <div class="space-y-6">
    <nav class="breadcrumbs text-sm" aria-label="Fil d'Ariane">
      <ul>
        <li><NuxtLink to="/admin/articles">Articles</NuxtLink></li>
        <li aria-current="page">Nouvel article</li>
      </ul>
    </nav>
    <h1 class="text-2xl font-bold">Nouvel article de veille</h1>
    <AdminArticleForm />
  </div>
</template>
