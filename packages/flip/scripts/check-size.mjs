// Enforces the @underlying/flip size budget on the built ESM bundle (gzip,
// level 9), with @underlying/core marked external - so the number is the NET
// cost on top of a core the app already ships, never core re-counted.
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

// Full surface includes flipGroup() (auto-FLIP, shared-element, presence enter/exit)
// and, since 1.2, reorder() (#69 drag-to-reorder: 3.0 -> 4.0). The core-only budget
// guards that flip()/play()/snapshot() callers tree-shake both away and keep paying
// the same small cost as before.
const FULL_BUDGET_BYTES = 4 * 1024
const CORE_BUDGET_BYTES = 1.5 * 1024

const bundleUrl = new URL('../dist/index.js', import.meta.url)
const distDir = dirname(fileURLToPath(bundleUrl))

const gzipBytes = (contents) => gzipSync(contents, { level: 9 }).length
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`

let failed = false
const check = (label, bytes, budget) => {
  const ok = bytes <= budget
  failed ||= !ok
  const line = `${label}: ${kb(bytes)} gzip (budget ${kb(budget)}) - ${ok ? 'OK' : 'BUDGET EXCEEDED'}`
  if (ok) console.log(line)
  else console.error(line)
}

const probe = async (fixture) => {
  const result = await build({
    stdin: { contents: fixture, resolveDir: distDir, loader: 'js' },
    bundle: true,
    treeShaking: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    external: ['@underlying/core', '@underlying/core/playback'],
    write: false,
    logLevel: 'silent',
  })
  return gzipBytes(result.outputFiles[0].contents)
}

check('@underlying/flip (full surface)', await probe("export * from './index.js'"), FULL_BUDGET_BYTES)
check(
  '@underlying/flip (flip/play/snapshot only)',
  await probe("export { flip, play, snapshot } from './index.js'"),
  CORE_BUDGET_BYTES,
)

process.exit(failed ? 1 : 0)
