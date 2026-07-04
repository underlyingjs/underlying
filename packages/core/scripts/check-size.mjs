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

// 15.25 kB since 1.2: #52 authoring ergonomics added staggerDelay()/responsive()/region()
// (12 -> 13.25), #68 added bindTemplate()/template() (13.25 -> 13.75), #41 added
// from()/fromTo() entrances (13.75 -> 14.0), then #56 added keyframe expressivity
// (per-segment ease/position/hold), attr routing, autoAlpha, and the filter() builder
// (14.0 -> 15.25).
const BUDGET_BYTES = 15.25 * 1024
// 3.6 kB: #56's autoAlpha adds the opacity->visibility toggle to bindStyle (in the primitives graph).
const PRIMITIVES_BUDGET_BYTES = 3.6 * 1024
// 12.5 kB since 1.2: animate() gained lifecycle callbacks (#67), #52 multi-target
// + relative/function value resolution, #41 the from-state capture/park path, then #56
// keyframe expressivity + attribute routing + autoAlpha in the animate graph (11.5 -> 12.5).
const ANIMATE_BUDGET_BYTES = 12.5 * 1024
// The opt-in playback layer: pause/timeScale/reverse/seek, bake(), follow(),
// timeScope, and sequence() (the live composition twin of @underlying/timeline).
// 6.5 kB since 1.2: #70 added the playhead queries (isActive/iteration/
// totalProgress/restart/startTime/endTime) across the handle variants (6.0 -> 6.5).
const PLAYBACK_BUDGET_BYTES = 6.5 * 1024

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
