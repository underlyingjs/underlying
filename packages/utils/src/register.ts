// Side-effect entry: `import '@underlying/utils/register'` registers every named
// ease into @underlying/core so string eases resolve ('power2.out', 'bounce.out',
// 'cubicBezier(0.25, 0.1, 0.25, 1)'). The main entry stays side-effect-free.
import { registerEasing } from '@underlying/core'
import { cubicBezier } from './custom-ease'
import { registerEases } from './eases'
import { rough, shake, slow, wiggle } from './procedural'

registerEases()
registerEasing('cubicbezier', (_variant, params) =>
  cubicBezier(params[0] ?? 0, params[1] ?? 0, params[2] ?? 1, params[3] ?? 1),
)
// Procedural eases by string (numeric knobs only; the non-numeric ones, like wave or
// taper, are the function-form escape hatch). The variant segment is a no-op here.
registerEasing('wiggle', (_variant, params) => wiggle(params[0] ?? 3))
registerEasing('shake', (_variant, params) => shake(params[0] ?? 6))
registerEasing('slow', (_variant, params) => slow(params[0] ?? 0.7, params[1] ?? 0.7))
registerEasing('rough', (_variant, params) =>
  rough({ points: params[0] ?? 20, amplitude: params[1] ?? 0.4, seed: params[2] ?? 1 }),
)
