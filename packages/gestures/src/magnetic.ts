import {
  bindStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  type Animatable,
  type Scheduler,
  type SpringOptions,
} from '@underlying/core'
import { follow } from '@underlying/core/playback'
import { onPointerMove } from './pointer-source'

export interface MagneticOptions {
  /** How far from the element's centre the pull engages, px. Default: half the element + 60. */
  radius?: number
  /** Fraction of the cursor offset the element follows. Default 0.3. */
  strength?: number
  /** The spring that chases the cursor and springs home on exit. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export interface Magnetic {
  /** The live x offset (px) - read it, bind it elsewhere, compose it. */
  readonly x: Animatable
  /** The live y offset (px). */
  readonly y: Animatable
  /** Remove the listeners, unbind the transform, release the values. */
  dispose(): void
}

/**
 * Pull an element toward the cursor when it comes within range, and spring it home
 * when the cursor leaves. The element follows a fraction of the cursor's offset
 * from its centre, chased by a spring, so a button leans into the pointer and
 * settles back - interruptible, never a restart. The offset is exposed as live
 * values, like draggable's x/y. Off on touch and under reduced motion (held home).
 */
export function magnetic(element: HTMLElement, options: MagneticOptions = {}): Magnetic {
  const strength = options.strength ?? 0.3
  const fixedRadius = options.radius
  const scheduler = options.scheduler
  const springConfig = { stiffness: 180, ...(options.spring ?? {}) }
  const followOptions = scheduler ? { ...springConfig, scheduler } : springConfig

  const fx = follow(0, followOptions)
  const fy = follow(0, followOptions)
  const unbind = bindStyle(element, { x: fx.value, y: fy.value })

  const home = (): void => {
    fx.target(0)
    fy.target(0)
  }

  const update = (px: number, py: number): void => {
    if (prefersReducedMotion()) {
      home()
      return
    }
    const r = element.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    const dx = px - (r.left + r.width / 2)
    const dy = py - (r.top + r.height / 2)
    const radius = fixedRadius ?? Math.max(r.width, r.height) / 2 + 60
    if (dx * dx + dy * dy < radius * radius) {
      fx.target(dx * strength)
      fy.target(dy * strength)
    } else {
      home()
    }
  }

  const offPointer = onPointerMove(update)
  // the cursor leaving the document stops pointermove; release the pull explicitly
  const onLeave = (): void => home()
  document.addEventListener('mouseleave', onLeave)
  const offPolicy = onReducedMotionChange((reduced) => {
    if (reduced) home()
  })

  return {
    x: fx.value,
    y: fy.value,
    dispose() {
      offPointer()
      document.removeEventListener('mouseleave', onLeave)
      offPolicy()
      unbind()
      fx.dispose()
      fy.dispose()
    },
  }
}
