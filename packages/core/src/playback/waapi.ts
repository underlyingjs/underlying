import type { DelegatedControls } from '../dom/animate'
import type { AnimationHandle } from '../value/animatable'
import { thenFinished } from '../value/thenable'
import { warnOnce } from '../value/warn'
import type { MotionKind, PlaybackHandle } from './handle'

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi)

/**
 * Map a PlaybackHandle onto a WAAPI-delegated tween. The scheduler wrapper cannot
 * pause the compositor, so these controls drive the native animation directly:
 * pause/play, currentTime for seek, playbackRate for timeScale and reverse. The
 * reclaim sign fix keeps an interrupted reversed tween's handoff velocity correct.
 */
export function waapiHandle(delegated: DelegatedControls, base: AnimationHandle, kind: MotionKind): PlaybackHandle {
  const animation = delegated.animation
  const durationMs = delegated.durationMs
  let paused = false
  let done = false
  void base.finished.then(() => {
    done = true
  })
  const progressNow = (): number => (durationMs <= 0 ? 1 : clamp(Number(animation.currentTime ?? 0) / durationMs, 0, 1))

  const handle: PlaybackHandle = {
    kind,
    seekable: true,
    finished: base.finished,
    then: thenFinished(base.finished),
    stop: () => base.stop(),
    pause() {
      animation.pause?.()
      paused = true
      return this
    },
    play() {
      animation.play?.()
      paused = false
      return this
    },
    resume() {
      return this.play()
    },
    isPaused: () => paused,
    timeScale(rate?: number): number | PlaybackHandle {
      if (rate === undefined) return animation.playbackRate ?? 1
      animation.playbackRate = rate
      return handle
    },
    reverse() {
      animation.playbackRate = -(animation.playbackRate ?? 1)
      return this
    },
    seek(timeMs: number) {
      animation.currentTime = clamp(timeMs, 0, durationMs)
      return this
    },
    progress(p?: number): number | PlaybackHandle {
      if (p === undefined) return progressNow()
      animation.currentTime = clamp(p, 0, 1) * durationMs
      return handle
    },
    time: () => Number(animation.currentTime ?? 0),
    totalTime: () => Number(animation.currentTime ?? 0),
    duration: () => durationMs,
    isActive: () => !done && !paused,
    iteration: () => 0, // a delegated tween runs a single iteration
    totalProgress: () => progressNow(),
    startTime: () => 0,
    endTime: () => durationMs,
    restart() {
      animation.currentTime = 0
      animation.play?.()
      paused = false
      return this
    },
    bake: () => true, // a delegated tween is already seekable
    setTarget() {
      warnOnce('playback:settarget-seekable', 'setTarget() re-aims a live spring; a tween uses seek()')
      return this
    },
  } as PlaybackHandle
  return handle
}
