import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      // Two entries: the lean core, and the opt-in playback layer. Shared
      // modules (animate, physics, scheduler) hoist into a common chunk, so
      // the playback bundle never duplicates the core it builds on.
      entry: { index: 'src/index.ts', 'playback/index': 'src/playback/index.ts' },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
