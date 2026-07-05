// Enforces the @underlying/angular size budget on the built FESM2022 bundle
// (gzip, level 9). ng-packagr keeps @angular/* and every @underlying/* package
// external, so the file is the NET cost of the adapter layer (the standalone
// directives) on top of the runtime the app already ships.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// The adapter is a thin binding layer, but the 12 standalone directives each
// carry Angular's decorator metadata, so the floor is higher than the function
// -based React/Vue adapters. This guards against it growing past that.
const FULL_BUDGET_BYTES = 4 * 1024

const fesmUrl = new URL('../dist/fesm2022/underlying-angular.mjs', import.meta.url)

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

check('@underlying/angular (full surface)', gzipBytes(readFileSync(fesmUrl)), FULL_BUDGET_BYTES)

process.exit(failed ? 1 : 0)
