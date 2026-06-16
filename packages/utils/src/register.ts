// Side-effect entry: `import '@underlying/utils/register'` registers every named
// ease into @underlying/core so string eases resolve ('power2.out', 'bounce.out',
// 'cubicBezier(0.25, 0.1, 0.25, 1)'). The main entry stays side-effect-free.
import { registerEasing } from '@underlying/core'
import { cubicBezier } from './custom-ease'
import { registerEases } from './eases'

registerEases()
registerEasing('cubicbezier', (_variant, params) =>
  cubicBezier(params[0] ?? 0, params[1] ?? 0, params[2] ?? 1, params[3] ?? 1),
)
