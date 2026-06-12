import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
