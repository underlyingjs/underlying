// Enforces the @underlying/react size budget on the built ESM bundle (gzip,
// level 9), with react and every @underlying/* package marked external - so the
// number is the NET cost of the adapter layer (hooks + ref wiring) on top of the
// core, gestures, text and flip the app already ships, never those re-counted.
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

// The adapter is a thin binding layer; this guards against it quietly growing.
const FULL_BUDGET_BYTES = 2 * 1024

const bundleUrl = new URL('../dist/index.js', import.meta.url)
const distDir = dirname(fileURLToPath(bundleUrl))

const gzipBytes = (contents) => gzipSync(contents, { level: 9 }).length
const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`

let failed = false
const check = (label, bytes, budget) => {
  const ok = bytes <= budget
  failed ||= !ok
  const status = ok ? 'OK' : 'BUDGET EXCEEDED'
  const line = `${label}: ${kb(bytes)} gzip (budget ${kb(budget)}) - ${status}`
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
    external: ['react', 'react-dom', '@underlying/*'],
    write: false,
    logLevel: 'silent',
  })
  return gzipBytes(result.outputFiles[0].contents)
}

const full = await probe(`import * as react from './index.js'\nconsole.log(react)`)
check('@underlying/react (full surface)', full, FULL_BUDGET_BYTES)

process.exit(failed ? 1 : 0)
