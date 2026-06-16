import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      // Entries: the lean core, the opt-in playback layer, the testing seam,
      // and the low-level physics primitive. Shared modules (animate, physics,
      // scheduler) hoist into a common chunk, so a subentry never duplicates
      // the core it builds on.
      entry: {
        index: 'src/index.ts',
        'playback/index': 'src/playback/index.ts',
        'testing/index': 'src/testing/index.ts',
        'physics/index': 'src/physics/index.ts',
      },
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
