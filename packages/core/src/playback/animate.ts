import { __getDelegated, animate, type AnimateOptions, type AnimateTargets } from '../dom/animate'
import type { AnimationHandle } from '../value/animatable'
import { warnOnce } from '../value/warn'
import type { MotionKind, PlaybackHandle, PlaybackOptions } from './handle'
import { timeScope, type TimeScope } from './time-scope'
import { waapiHandle } from './waapi'

/**
 * The JS path (springs, or a tween with no WAAPI): pause / timeScale ride the
 * private timeScope. There is no external playhead, so seek / progress / reverse
 * warn once and no-op. For a seekable DOM tween, delegate to WAAPI (see above).
 */
function scopeHandle(scope: TimeScope, base: AnimationHandle, kind: MotionKind): PlaybackHandle {
  const handle: PlaybackHandle = {
    kind,
    seekable: false,
    finished: base.finished,
    stop: () => base.stop(),
    pause() {
      scope.pause()
      return this
    },
    play() {
      scope.resume()
      return this
    },
    resume() {
      scope.resume()
      return this
    },
    isPaused: () => scope.isPaused(),
    timeScale(rate?: number): number | PlaybackHandle {
      if (rate === undefined) return scope.getTimeScale()
      scope.setTimeScale(rate)
      return handle
    },
    reverse() {
      warnOnce('playback:reverse-js', 'reverse() needs a WAAPI-delegated tween; bake a spring for a seekable clip')
      return this
    },
    seek() {
      warnOnce('playback:seek-live', 'seek()/progress() need a seekable (WAAPI-delegated) handle')
      return this
    },
    progress(p?: number): number | PlaybackHandle {
      if (p === undefined) return 0
      warnOnce('playback:seek-live', 'seek()/progress() need a seekable (WAAPI-delegated) handle')
      return handle
    },
    time: () => 0,
    totalTime: () => 0,
    duration: () => undefined,
    bake: () => false,
    setTarget() {
      warnOnce('playback:settarget-dom', 'setTarget() is for an imperative value; use playable() for live re-aim')
      return this
    },
  } as PlaybackHandle
  return handle
}

/**
 * animate() that returns a PlaybackHandle. A delegated tween (duration + WAAPI)
 * is controlled natively (pause/seek/timeScale/reverse, lossless and
 * off-main-thread); everything else runs on a private timeScope that pause and
 * timeScale drive. repeat / delay / yoyo are not modelled here - reach for
 * playable() on an imperative value when you need them.
 */
export function animatePlayback(
  element: HTMLElement,
  targets: AnimateTargets,
  options: AnimateOptions & PlaybackOptions = {},
): PlaybackHandle {
  if (options.repeat !== undefined || options.delay !== undefined || options.yoyo === true) {
    warnOnce('playback:dom-repeat', 'repeat/delay/yoyo are not supported on animatePlayback; use playable()')
  }

  const scopeOptions = options.scheduler !== undefined ? { scheduler: options.scheduler } : {}
  const scope = timeScope(scopeOptions)
  const base = animate(element, targets, { ...options, scheduler: scope })

  const kind: MotionKind = options.duration !== undefined ? 'timeline' : 'physics'
  const delegated = __getDelegated(element)

  if (delegated !== null) {
    if (options.timeScale !== undefined) delegated.animation.playbackRate = options.timeScale
    if (options.paused === true) {
      delegated.animation.pause?.()
    }
    return waapiHandle(delegated, base, kind)
  }

  if (options.timeScale !== undefined) scope.setTimeScale(options.timeScale)
  if (options.paused === true) scope.pause()
  return scopeHandle(scope, base, kind)
}
