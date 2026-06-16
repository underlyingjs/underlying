import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      entry: { index: 'src/index.ts', register: 'src/register.ts' },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    sourcemap: true,
    rollupOptions: {
      // @underlying/core is a peer the app already ships; never bundle it in.
      external: [/^@underlying\/core/],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
