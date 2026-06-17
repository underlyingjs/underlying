import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The brand assets (wordmark, favicons, the Fraunces face) live in the repo-root
// brand/ folder, shared by the docs site, this landing, the README and npm.
const corePackage = readFileSync(new URL('../../packages/core/package.json', import.meta.url), 'utf8')
const coreVersion = (JSON.parse(corePackage) as { version: string }).version

export default defineConfig({
  // A dedicated, fixed port so the landing never collides with the docs site
  // (which holds Vite's default 5173 via `pnpm demo`). strictPort keeps the URL
  // deterministic instead of silently hopping to the next free port.
  server: { port: 4000, strictPort: true },
  publicDir: fileURLToPath(new URL('../../brand', import.meta.url)),
  define: {
    __CORE_VERSION__: JSON.stringify(coreVersion),
  },
})
