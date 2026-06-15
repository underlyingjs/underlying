import { animatable, getSharedScheduler, type Animatable, type Scheduler } from '@underlying/core'
import { scalarControls, type ScalarControls } from './handle'

/** An element that can be stroke-drawn: reports its length and has a writable style. */
export interface DrawElement {
  getTotalLength(): number
  style: { strokeDasharray: string; strokeDashoffset: string }
}

/** A draw source: a CSS selector or a stroked geometry element. */
export type DrawInput = string | DrawElement

export interface DrawOptions {
  /** Scheduler driving the value and the style flush. Defaults to the shared one. */
  scheduler?: Scheduler
  /** Initial draw fraction, 0..1 (0 hidden, 1 drawn). Default 0. */
  from?: number
  /** Spring to this fraction on creation - the GSAP-familiar one-call form. */
  to?: number
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

function resolveDrawElement(path: DrawInput): DrawElement {
  if (typeof path !== 'string') return path
  if (typeof document === 'undefined') {
    throw new Error('@underlying/svg: a selector needs a DOM; pass an element on the server')
  }
  const element = document.querySelector(path)
  if (element === null) throw new Error(`@underlying/svg: no element matches "${path}"`)
  return element as unknown as DrawElement
}

/**
 * Low-level binder: map a driver Animatable (0..1) onto an element's stroke
 * draw-on (0 = hidden, 1 = fully drawn) via stroke-dasharray/offset. You own the
 * driver. Returns an unbind fn that restores the original dash properties.
 */
export function bindDraw(path: DrawInput, source: Animatable, options: DrawOptions = {}): () => void {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const element = resolveDrawElement(path)
  const length = element.getTotalLength()
  const previousDasharray = element.style.strokeDasharray
  const previousDashoffset = element.style.strokeDashoffset
  element.style.strokeDasharray = String(length)

  let dirty = false
  let cancelFlush: (() => void) | null = null

  const write = (): void => {
    element.style.strokeDashoffset = String(length * (1 - clamp01(source.get())))
  }
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
    element.style.strokeDasharray = previousDasharray
    element.style.strokeDashoffset = previousDashoffset
  }
}

export interface Draw extends ScalarControls {
  /** The live 0..1 draw fraction (0 hidden, 1 drawn). Compose it anywhere. */
  readonly fraction: Animatable
}

/**
 * Draw a stroke on, physics-first. The fraction is a live Animatable - spring it
 * in (it can overshoot), interrupt it mid-draw, flick it, or scrub it from
 * scroll. Restores the original stroke-dash properties on revert().
 */
export function draw(path: DrawInput, options: DrawOptions = {}): Draw {
  const fraction = animatable(
    options.from ?? 0,
    options.scheduler !== undefined ? { scheduler: options.scheduler } : undefined,
  )
  const unbind = bindDraw(path, fraction, options)

  const revert = (): void => {
    fraction.stop()
    unbind()
    fraction.dispose()
  }

  if (options.to !== undefined) fraction.spring(options.to)

  return { fraction, ...scalarControls(fraction, revert) }
}
