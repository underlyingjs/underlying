import { UnderlyingAnimateDirective } from './animate.directive'
import { UnderlyingDraggableDirective } from './draggable.directive'
import { UnderlyingReorderDirective } from './flip.directive'
import {
  UnderlyingAmbientDirective,
  UnderlyingDepthDirective,
  UnderlyingInteractiveDirective,
  UnderlyingMagneticDirective,
  UnderlyingTiltDirective,
} from './gestures.directives'
import {
  UnderlyingRevealDirective,
  UnderlyingScrambleDirective,
  UnderlyingSplitDirective,
  UnderlyingTypewriterDirective,
} from './text.directives'

export { UnderlyingAnimateDirective } from './animate.directive'
export { UnderlyingDraggableDirective } from './draggable.directive'
export { UnderlyingReorderDirective } from './flip.directive'
export {
  UnderlyingAmbientDirective,
  UnderlyingDepthDirective,
  UnderlyingInteractiveDirective,
  UnderlyingMagneticDirective,
  UnderlyingTiltDirective,
} from './gestures.directives'
export {
  UnderlyingRevealDirective,
  UnderlyingScrambleDirective,
  UnderlyingSplitDirective,
  UnderlyingTypewriterDirective,
} from './text.directives'

/**
 * Every directive, for one-line import into a standalone component:
 * `imports: [...UNDERLYING_DIRECTIVES]`.
 */
export const UNDERLYING_DIRECTIVES = [
  UnderlyingAnimateDirective,
  UnderlyingDraggableDirective,
  UnderlyingReorderDirective,
  UnderlyingTiltDirective,
  UnderlyingMagneticDirective,
  UnderlyingDepthDirective,
  UnderlyingAmbientDirective,
  UnderlyingInteractiveDirective,
  UnderlyingSplitDirective,
  UnderlyingRevealDirective,
  UnderlyingTypewriterDirective,
  UnderlyingScrambleDirective,
] as const
