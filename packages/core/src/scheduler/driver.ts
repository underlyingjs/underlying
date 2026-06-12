/** Cancels a frame scheduled via FrameDriver.schedule. */
export type CancelFrame = () => void

/**
 * Source of display frames. The production driver wraps requestAnimationFrame;
 * tests inject a manual driver to control timestamps deterministically.
 * The scheduler is the only consumer - no other module may schedule frames.
 */
export interface FrameDriver {
  schedule(callback: (timestampMs: number) => void): CancelFrame
}

// Browser globals are only touched when schedule() is called, never at module
// evaluation - importing the core must stay safe under SSR.
export const rafDriver: FrameDriver = {
  schedule(callback) {
    const id = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(id)
  },
}
