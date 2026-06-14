// Enforces the @underlying/text size budget on the built ESM bundle (gzip,
// level 9), with @underlying/core marked external - so the number is the NET
// cost on top of a core the app already ships, never core re-counted.
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const FULL_BUDGET_BYTES = 6 * 1024

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
    external: ['@underlying/core', '@underlying/core/playback'],
    write: false,
    logLevel: 'silent',
  })
  return gzipBytes(result.outputFiles[0].contents)
}

const full = await probe(`import * as text from './index.js'\nconsole.log(text)`)
check('@underlying/text (full surface)', full, FULL_BUDGET_BYTES)

process.exit(failed ? 1 : 0)
