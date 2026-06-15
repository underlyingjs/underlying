import { animatable, getSharedScheduler, type Animatable, type Scheduler } from '@underlying/core'
import { samplePath, type PathInput, type SamplePathOptions } from './geometry'
import { scalarControls, type ScalarControls } from './handle'

export interface PathBindOptions extends SamplePathOptions {
  /**
   * Turn the element to face along the path. `true` aligns to the tangent;
   * a number adds that many degrees of offset (e.g. `90` for a north-up icon).
   */
  autoRotate?: boolean | number
  /** Scheduler driving the value and the style flush. Defaults to the shared one. */
  scheduler?: Scheduler
}

export interface MotionPathOptions extends PathBindOptions {
  /** Initial progress, 0..1. Default 0. */
  from?: number
  /** Spring to this progress on creation - the GSAP-familiar one-call form. */
  to?: number
}

/**
 * Low-level binder: map a driver Animatable (0..1) onto an element's transform
 * along a path. You own the driver - spring, decay, or scrub it from scroll or a
 * timeline. Writes the current point synchronously at bind; returns an unbind fn.
 */
export function bindPath(
  element: HTMLElement | SVGElement,
  path: PathInput,
  source: Animatable,
  options: PathBindOptions = {},
): () => void {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const sampler = samplePath(path, options)
  const autoRotate = options.autoRotate ?? false
  const rotates = autoRotate !== false
  const offset = typeof autoRotate === 'number' ? autoRotate : 0

  let dirty = false
  let cancelFlush: (() => void) | null = null

  const write = (): void => {
    const point = sampler.at(source.get())
    const move = `translate3d(${point.x}px, ${point.y}px, 0)`
    element.style.transform = rotates ? `${move} rotate(${point.angle + offset}deg)` : move
  }

  // One-shot render subscription per change burst: flush once on the next frame,
  // then let the scheduler sleep - same pattern as core's bindStyle.
  const scheduleFlush = (): void => {
    if (cancelFlush !== null) return
    cancelFlush = scheduler.subscribe(() => {
      cancelFlush?.()
      cancelFlush = null
      if (dirty) {
        dirty = false
        write()
      }
    }, 'render')
  }

  const unsubscribe = source.on('change', () => {
    dirty = true
    scheduleFlush()
  })
  write()

  return () => {
    unsubscribe()
    cancelFlush?.()
    cancelFlush = null
  }
}

export interface MotionPath extends ScalarControls {
  /** The live 0..1 driver. Compose it: scroll.scrub(mp.t), a timeline, a sequence. */
  readonly t: Animatable
}

/**
 * Ride an element along an SVG path, physics-first. Progress `t` is a live
 * Animatable, so you can spring it, flick it down the path and let it settle,
 * retarget it mid-flight (velocity conserved), or hand `t` to scroll/timeline.
 * `autoRotate` turns the element to face along the path.
 */
export function motionPath(
  element: HTMLElement | SVGElement,
  path: PathInput,
  options: MotionPathOptions = {},
): MotionPath {
  const t = animatable(
    options.from ?? 0,
    options.scheduler !== undefined ? { scheduler: options.scheduler } : undefined,
  )
  const previousTransform = element.style.transform
  const unbind = bindPath(element, path, t, options)

  const revert = (): void => {
    t.stop()
    unbind()
    t.dispose()
    element.style.transform = previousTransform
  }

  if (options.to !== undefined) t.spring(options.to)

  return { t, ...scalarControls(t, revert) }
}
