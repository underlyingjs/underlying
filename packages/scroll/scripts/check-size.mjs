// Enforces the @underlying/scroll size budget on the built ESM bundle (gzip,
// level 9), with @underlying/core marked external - so the number is the NET
// cost on top of a core the app already ships, never core re-counted.
//
// The full public surface (createScroll + scrub/parallax/pin/snap/trigger) is
// one cohesive unit: the high-level sugar are methods on the controller (the
// GSAP-muscle-memory API), so they do not tree-shake apart. The whole surface
// is the gate. We also report the prod-only path to prove the manual test
// source (createManualScrollSource) stays out of an app that never imports it.
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

// Bundle a fixture importing the given surface, tree-shaken + minified, with
// core external - so the probe measures exactly scroll's own import graph.
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

const full = await probe(`import * as scroll from './index.js'\nconsole.log(scroll)`)
const prod = await probe(
  `import { createScroll } from './index.js'\nconst s = createScroll()\ns.scrub(() => {})\ns.parallax({ output: [0, 1] })\nconsole.log(s)`,
)

check('@underlying/scroll (full surface)', full, FULL_BUDGET_BYTES)
check('createScroll prod path (no manual source)', prod, FULL_BUDGET_BYTES)
// The prod path must not drag in the manual test source.
if (prod >= full) {
  console.error('tree-shake: createManualScrollSource leaked into the prod path')
  failed = true
} else {
  console.log(`tree-shake: manual source stays out of the prod path (${kb(full - prod)} saved) - OK`)
}

process.exit(failed ? 1 : 0)
