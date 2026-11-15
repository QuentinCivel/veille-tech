import { defineConfig } from 'vitest/config'

// Tests unitaires de la logique pure (sans Nuxt ni Firestore).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  }
})
