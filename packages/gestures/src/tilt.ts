import {
  animatable,
  bindStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  type Animatable,
  type Scheduler,
  type SpringOptions,
} from '@underlying/core'
import { follow } from '@underlying/core/playback'

export interface TiltOptions {
  /** Max tilt at the edges, degrees. Default 12. */
  max?: number
  /** The 3D depth (the perspective() distance, px). Smaller = stronger. Default 600. */
  perspective?: number
  /** A small lift while hovered (scale). Default 1 (none). */
  scale?: number
  /** Tilt away from the cursor instead of toward it. */
  reverse?: boolean
  /** The spring that chases the cursor and springs flat on leave. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export interface Tilt {
  /** The live tilt about the X axis (deg) - read it, bind it elsewhere, compose it. */
  readonly rotateX: Animatable
  /** The live tilt about the Y axis (deg). */
  readonly rotateY: Animatable
  /** Remove the listeners, unbind the transform, release the values. */
  dispose(): void
}

/**
 * Tilt an element in 3D toward the cursor and spring it flat on leave. The pointer
 * position over the element maps to two rotations that a spring chases, so the card
 * follows your cursor live and, when you leave, eases back to flat - interruptible,
 * never a restart. Hand it `{ scale }` for a small hover lift. Off on touch and
 * under reduced motion (held flat). The rotations are live values you can also read
 * or bind elsewhere, exactly like draggable's x/y.
 */
export function tilt(element: HTMLElement, options: TiltOptions = {}): Tilt {
  const max = options.max ?? 12
  const persp = options.perspective ?? 600
  const lift = options.scale ?? 1
  const sign = options.reverse ? -1 : 1
  const springConfig = { stiffness: 220, ...(options.spring ?? {}) }
  const scheduler = options.scheduler

  const followOptions = scheduler ? { ...springConfig, scheduler } : springConfig
  const rx = follow(0, followOptions)
  const ry = follow(0, followOptions)
  const sc = lift !== 1 ? follow(1, followOptions) : null
  const perspV = animatable(persp, scheduler ? { scheduler } : {})

  const unbind = bindStyle(
    element,
    sc
      ? { perspective: perspV, rotateX: rx.value, rotateY: ry.value, scale: sc.value }
      : { perspective: perspV, rotateX: rx.value, rotateY: ry.value },
  )

  const flatten = (): void => {
    rx.target(0)
    ry.target(0)
    sc?.target(1)
  }

  const onMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || prefersReducedMotion()) {
      flatten()
      return
    }
    const r = element.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    const nx = (event.clientX - r.left) / r.width - 0.5 // -0.5 (left) .. 0.5 (right)
    const ny = (event.clientY - r.top) / r.height - 0.5 // -0.5 (top) .. 0.5 (bottom)
    ry.target(sign * nx * 2 * max) // horizontal pointer -> tilt about Y; edge -> +-max
    rx.target(sign * -ny * 2 * max) // vertical pointer -> tilt about X
    sc?.target(lift)
  }

  element.addEventListener('pointermove', onMove as EventListener)
  element.addEventListener('pointerleave', flatten)
  element.addEventListener('pointercancel', flatten)
  const offPolicy = onReducedMotionChange((reduced) => {
    if (reduced) flatten()
  })

  return {
    rotateX: rx.value,
    rotateY: ry.value,
    dispose() {
      element.removeEventListener('pointermove', onMove as EventListener)
      element.removeEventListener('pointerleave', flatten)
      element.removeEventListener('pointercancel', flatten)
      offPolicy()
      unbind()
      rx.dispose()
      ry.dispose()
      sc?.dispose()
      perspV.dispose()
    },
  }
}
