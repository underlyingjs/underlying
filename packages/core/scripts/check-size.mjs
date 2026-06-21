// Enforces the core size budgets on the built ESM bundle (gzip, level 9):
//  - the full public surface stays under the headline budget;
//  - a primitives-only user (animatable/bindStyle/physics) ships ZERO of the
//    value model (the lazy registry + parsers must stay tree-shakeable);
//  - the animate() import graph (which deliberately pulls the registry and the
//    four built-in parsers) cannot creep unnoticed.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const BUDGET_BYTES = 12 * 1024
const PRIMITIVES_BUDGET_BYTES = 3.5 * 1024
// 10 kB since 1.1: animate() gained lifecycle callbacks (#67 - onStart/onUpdate/onComplete/onInterrupt + scope).
const ANIMATE_BUDGET_BYTES = 10 * 1024
// The opt-in playback layer: pause/timeScale/reverse/seek, bake(), follow(),
// timeScope, and sequence() (the live composition twin of @underlying/timeline).
const PLAYBACK_BUDGET_BYTES = 6 * 1024

const bundleUrl = new URL('../dist/index.js', import.meta.url)
const playbackUrl = new URL('../dist/playback/index.js', import.meta.url)
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

// Bundle a fixture that imports only the given exports, tree-shaken + minified,
// so the probe measures exactly the import graph those entry points pull in.
const probeFrom = async (entry, fixture) => {
  const result = await build({
    stdin: { contents: fixture, resolveDir: distDir, loader: 'js' },
    bundle: true,
    treeShaking: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
  })
  return gzipBytes(result.outputFiles[0].contents)
}

// Multi-entry splits shared code into a chunk, so dist/index.js alone is a
// re-export shim. Re-bundle the whole entry to measure the real full surface.
const probe = (imports) => probeFrom('index.js', `import { ${imports.join(', ')} } from './index.js'\nconsole.log(${imports.join(', ')})`)
const probeFull = () => probeFrom('index.js', `import * as core from './index.js'\nconsole.log(core)`)

check('@underlying/core (full)', await probeFull(), BUDGET_BYTES)
check(
  'primitives only (animatable/bindStyle/physics)',
  await probe(['animatable', 'bindStyle', 'stagger', 'chain', 'prefersReducedMotion']),
  PRIMITIVES_BUDGET_BYTES,
)
check('animate() import graph', await probe(['animate']), ANIMATE_BUDGET_BYTES)
// The playback bundle imports the shared core chunk, so its own file IS the net
// cost of adding playback on top of a core you already ship.
check('@underlying/core/playback (net)', gzipBytes(readFileSync(playbackUrl)), PLAYBACK_BUDGET_BYTES)

process.exit(failed ? 1 : 0)
