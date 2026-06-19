import {
  bindStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  type Scheduler,
  type SpringOptions,
} from '@underlying/core'
import { follow } from '@underlying/core/playback'
import { currentPointer, onPointerMove } from './pointer-source'

const DEFAULT_TARGETS = 'a, button, [role="button"], input, select, textarea, label, [tabindex]'

export interface CursorOptions {
  /** Drive an existing element. Omit and a <div> is created and appended to <body>. */
  element?: HTMLElement
  /** Class on the cursor. Default 'cursor'. The over-target state adds `${className}--active`. */
  className?: string
  /** Selector whose elements flip the cursor to its active state. */
  targets?: string
  /** The follow spring - the trailing lag behind the real pointer. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export interface Cursor {
  /** The cursor element. Style it (and `.<class>--active`); the library only moves it. */
  readonly element: HTMLElement
  /** Remove the listeners, unbind, and (if it was created here) remove the element. */
  dispose(): void
}

/**
 * A custom cursor that trails the real pointer with spring lag and flips to an
 * active state over interactive targets. The library only positions it - you give
 * it its look through `.cursor` and `.cursor--active` CSS. It rides the shared
 * pointer source, so it stays one listener even alongside magnetic, and starts
 * where the cursor already is rather than swooping from the origin. Hidden on touch
 * and under reduced motion (the native cursor stays).
 */
export function cursor(options: CursorOptions = {}): Cursor {
  const className = options.className ?? 'cursor'
  const targets = options.targets ?? DEFAULT_TARGETS
  const activeClass = `${className}--active`
  const scheduler = options.scheduler
  const owned = options.element === undefined
  const element = options.element ?? document.createElement('div')
  if (owned) {
    element.className = className
    element.setAttribute('aria-hidden', 'true')
    document.body.appendChild(element)
  }
  element.style.position = 'fixed'
  element.style.left = '0'
  element.style.top = '0'
  element.style.pointerEvents = 'none'

  const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? true
  const springConfig = { stiffness: 280, ...(options.spring ?? {}) }
  const followOptions = scheduler ? { ...springConfig, scheduler } : springConfig

  const start = currentPointer()
  const fx = follow(start.known ? start.x : window.innerWidth / 2, followOptions)
  const fy = follow(start.known ? start.y : window.innerHeight / 2, followOptions)
  const unbind = bindStyle(element, { x: fx.value, y: fy.value })

  const onMove = (px: number, py: number): void => {
    fx.target(px)
    fy.target(py)
  }
  const onOver = (event: Event): void => {
    const target = event.target as Element | null
    element.classList.toggle(activeClass, target?.closest?.(targets) != null)
  }

  let off: (() => void) | null = null
  const enable = (): void => {
    if (off !== null || !finePointer || prefersReducedMotion()) return
    element.style.display = ''
    const offPointer = onPointerMove(onMove)
    document.addEventListener('pointerover', onOver)
    off = () => {
      offPointer()
      document.removeEventListener('pointerover', onOver)
    }
  }
  const disable = (): void => {
    off?.()
    off = null
    element.style.display = 'none'
    element.classList.remove(activeClass)
  }

  element.style.display = 'none' // hidden until enabled
  enable()
  const offPolicy = onReducedMotionChange(() => {
    if (prefersReducedMotion()) disable()
    else enable()
  })

  return {
    element,
    dispose() {
      disable()
      offPolicy()
      unbind()
      fx.dispose()
      fy.dispose()
      if (owned) element.remove()
    },
  }
}
