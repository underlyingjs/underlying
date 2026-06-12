// Enforces the core size budget on the built ESM bundle (gzip, level 9).
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 10 * 1024

const bundle = new URL('../dist/index.js', import.meta.url)
const gzipped = gzipSync(readFileSync(bundle), { level: 9 }).length
const report = `${(gzipped / 1024).toFixed(2)} kB gzip (budget ${BUDGET_BYTES / 1024} kB)`

if (gzipped > BUDGET_BYTES) {
  console.error(`@underlying/core: ${report} - BUDGET EXCEEDED`)
  process.exit(1)
}
console.log(`@underlying/core: ${report} - OK`)
