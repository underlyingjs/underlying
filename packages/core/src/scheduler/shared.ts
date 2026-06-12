import { rafDriver } from './driver'
import { createScheduler, type Scheduler } from './scheduler'

// All animatables and bindings batch into the same rAF loop. Created lazily
// so that merely importing the core never touches browser globals (SSR-safe).
let shared: Scheduler | null = null

export const getSharedScheduler = (): Scheduler => (shared ??= createScheduler(rafDriver))
