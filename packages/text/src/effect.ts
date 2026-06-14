import { prefersReducedMotion, type FrameInfo, type Scheduler } from '@underlying/core'

export interface TextEffect {
  /** Resolves when the effect completes (or on stop). Never rejects. */
  readonly finished: Promise<void>
  /** Snap to the final text now. */
  stop(): void
}

/**
 * Shared runner for the content effects (scramble, typewriter). The final text
 * is the accessible name throughout (aria-label on the element) and the visible,
 * changing text is aria-hidden - so a screen reader reads the result, never the
 * intermediate gibberish. Runs on the frame clock (background-tab-safe), and
 * under reduced motion it lands on the final text immediately.
 */
export function runTextEffect(
  element: HTMLElement,
  finalText: string,
  duration: number,
  scheduler: Scheduler,
  render: (progress: number) => string,
): TextEffect {
  const previousLabel = element.getAttribute('aria-label')
  element.setAttribute('aria-label', finalText)
  const holder = document.createElement('span')
  holder.setAttribute('aria-hidden', 'true')
  element.replaceChildren(holder)

  let resolveFinished: () => void = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const finish = (): void => {
    element.textContent = finalText
    if (previousLabel === null) element.removeAttribute('aria-label')
    else element.setAttribute('aria-label', previousLabel)
    resolveFinished()
  }

  if (prefersReducedMotion()) {
    finish()
    return { finished, stop() {} }
  }

  let elapsed = 0
  let done = false
  let unsubscribe: () => void = () => {}
  const frame = ({ deltaMs }: FrameInfo): void => {
    if (done) return
    elapsed += deltaMs
    const progress = Math.min(elapsed / duration, 1)
    holder.textContent = render(progress)
    if (progress >= 1) {
      done = true
      unsubscribe()
      finish()
    }
  }
  unsubscribe = scheduler.subscribe(frame)

  return {
    finished,
    stop() {
      if (done) return
      done = true
      unsubscribe()
      finish()
    },
  }
}
