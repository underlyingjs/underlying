import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Inject @underlying/core's package version at build time so the docs badge
// tracks releases instead of being hand-edited. The library deliberately ships
// no runtime VERSION export, so we read it from its package.json here.
const corePackage = readFileSync(new URL('../../packages/core/package.json', import.meta.url), 'utf8')
const coreVersion = (JSON.parse(corePackage) as { version: string }).version

export default defineConfig({
  define: {
    __CORE_VERSION__: JSON.stringify(coreVersion),
  },
})
