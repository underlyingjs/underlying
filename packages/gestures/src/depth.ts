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
import { currentPointer, onPointerMove } from './pointer-source'

export type DepthAxis = 'both' | 'x' | 'y'

export interface DepthOptions {
  /**
   * Travel at the frame edge, px - the layer's depth magnitude (normalized
   * pointer = +/-1). Far layers take a small shift, near layers a large one;
   * the ascending values are the depth ramp. Sign sets direction. Default 24.
   */
  shift?: number
  /** Restrict travel to one axis; the other channel rests at 0. Default 'both'. */
  axis?: DepthAxis
  /** false (default) = the layer moves AGAINST the pointer (motion-parallax recession); true = with it. */
  invert?: boolean
  /**
   * The frame the pointer is normalized against. 'viewport' measures from the
   * window centre (a hero filling the fold). An element measures about its own
   * rect centre, re-read on every move - so a card reacts about itself and a
   * scrolled hero stays correct with no resize listener. Default 'viewport'.
   */
  frame?: 'viewport' | HTMLElement
  /** Clamp the normalized pointer to [-1,1] before scaling, so travel never exceeds +/-shift. Default true. */
  clamp?: boolean
  /** The chase spring - a slow, heavy drift, not a snap. Default { stiffness: 120 }. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export interface DepthLayer {
  /** The live x offset (px) - read it, bind it elsewhere, compose it, like draggable's x. */
  readonly x: Animatable
  /** The live y offset (px). On a single-axis layer this is a constant 0. */
  readonly y: Animatable
  /** Unbind the transform, release the springs and listeners. */
  dispose(): void
}

const clamp1 = (n: number): number => (n < -1 ? -1 : n > 1 ? 1 : n)

/**
 * Pointer-driven depth parallax: a layer drifts by a fraction of the pointer's
 * offset from a frame centre, chased by a spring, so stacked layers given
 * ascending `shift` read as depth. The offset is exposed as live values, like
 * draggable's x/y. Stack several layers - they share one pointer listener. It is
 * a 2.5D illusion through differential translate, not a real z-translate, so it
 * owns the element's x/y transform. Off on touch and held flat under reduced
 * motion. For a whole hero, call it once per layer with rising `shift` values.
 */
export function depth(element: HTMLElement, options: DepthOptions = {}): DepthLayer {
  const shift = options.shift ?? 24
  const axis = options.axis ?? 'both'
  const sign = options.invert ? 1 : -1
  const frame = options.frame ?? 'viewport'
  const doClamp = options.clamp ?? true
  const scheduler = options.scheduler
  const springConfig = { stiffness: 120, ...(options.spring ?? {}) }
  const followOptions = scheduler ? { ...springConfig, scheduler } : springConfig

  const useX = axis !== 'y'
  const useY = axis !== 'x'
  const fx = useX ? follow(0, followOptions) : null
  const fy = useY ? follow(0, followOptions) : null
  // the inactive axis is exposed as a shared constant 0, never a live spring
  const zero = useX && useY ? null : animatable(0, scheduler ? { scheduler } : {})

  const channels: { x?: Animatable; y?: Animatable } = {}
  if (fx) channels.x = fx.value
  if (fy) channels.y = fy.value
  const unbind = bindStyle(element, channels)

  const home = (): void => {
    fx?.target(0)
    fy?.target(0)
  }

  const update = (px: number, py: number): void => {
    if (prefersReducedMotion()) {
      home()
      return
    }
    let halfW: number
    let halfH: number
    let cx: number
    let cy: number
    if (frame === 'viewport') {
      halfW = window.innerWidth / 2
      halfH = window.innerHeight / 2
      if (halfW === 0 || halfH === 0) return // a 0-size viewport would divide to NaN
      cx = halfW
      cy = halfH
    } else {
      const r = frame.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      halfW = r.width / 2
      halfH = r.height / 2
      cx = r.left + halfW
      cy = r.top + halfH
    }
    let nx = (px - cx) / halfW
    let ny = (py - cy) / halfH
    if (doClamp) {
      nx = clamp1(nx)
      ny = clamp1(ny)
    }
    fx?.target(sign * nx * shift)
    fy?.target(sign * ny * shift)
  }

  // warm start: if the pointer is already known, ease in from where it is
  const seed = currentPointer()
  if (seed.known) update(seed.x, seed.y)

  const offPointer = onPointerMove(update)
  // the cursor leaving the window stops pointermove; ease the layers home
  const onLeave = (): void => home()
  document.addEventListener('mouseleave', onLeave)
  const offPolicy = onReducedMotionChange((reduced) => {
    if (reduced) {
      home()
    } else {
      // resume from where the pointer already is, without waiting for a move
      const p = currentPointer()
      if (p.known) update(p.x, p.y)
    }
  })

  return {
    x: fx ? fx.value : (zero as Animatable),
    y: fy ? fy.value : (zero as Animatable),
    dispose() {
      offPointer()
      document.removeEventListener('mouseleave', onLeave)
      offPolicy()
      unbind()
      fx?.dispose()
      fy?.dispose()
      zero?.dispose()
    },
  }
}
