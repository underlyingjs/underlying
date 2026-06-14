// Test-only entry: the manual frame driver, so downstream packages build a
// deterministic scheduler from published API instead of reaching into internals.
export { createManualDriver } from '../scheduler/manual-driver'
export type { ManualDriver } from '../scheduler/manual-driver'
