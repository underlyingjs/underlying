import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The panorama shows every package's real version - read them at build, never hand-typed.
const PACKAGES = ['core', 'scroll', 'gestures', 'flip', 'svg', 'text', 'timeline', 'utils', 'react', 'vue', 'angular']
const packageVersions: Record<string, string> = {}
for (const name of PACKAGES) {
  const raw = readFileSync(new URL(`../../packages/${name}/package.json`, import.meta.url), 'utf8')
  packageVersions[name] = (JSON.parse(raw) as { version: string }).version
}

export default defineConfig({
  // A dedicated, fixed port so the landing never collides with the docs site
  // (which holds Vite's default 5173 via `pnpm docs`). strictPort keeps the URL
  // deterministic instead of silently hopping to the next free port.
  server: { port: 4000, strictPort: true },
  publicDir: fileURLToPath(new URL('../../brand', import.meta.url)),
  define: {
    __PKG_VERSIONS__: JSON.stringify(packageVersions),
  },
})
