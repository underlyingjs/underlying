import type { AnimationHandle } from '../value/animatable'

/** 'physics' = a live spring/decay (target-chase); 'timeline' = a tween or baked table (seekable). */
export type MotionKind = 'physics' | 'timeline'

/**
 * A superset of AnimationHandle: every `{ finished, stop }` consumer keeps
 * working, while opt-in users get pause / timeScale / reverse / seek / progress.
 * Kind-invalid controls warn once and no-op, never throw (the warnOnce house
 * convention). The `kind` / `seekable` flags make the spring-vs-tween split
 * self-describing.
 */
export interface PlaybackHandle extends AnimationHandle {
  /** 'physics' = live spring/decay; 'timeline' = tween or baked table. */
  readonly kind: MotionKind
  /** True once seekable: always for tweens, for physics only after a successful bake(). */
  readonly seekable: boolean

  // --- Universal: both kinds, live or baked ---
  /** Freeze the accumulator AND unsubscribe so the loop can sleep. Resumable. */
  pause(): this
  /** Resume real time. No-op if not paused. */
  play(): this
  /** Alias of play(). */
  resume(): this
  isPaused(): boolean
  /** Time dilation; the step size stays 1/120 so the trajectory shape is unchanged. 0 acts like pause. */
  timeScale(rate: number): this
  timeScale(): number
  /** Tween/baked: play the curve backward (lossless). Live physics: retarget to start, velocity conserved. */
  reverse(): this

  // --- Seekable only (tween / baked). Live physics: warn once + no-op ---
  /** Jump the playhead to an absolute time (ms). */
  seek(timeMs: number): this
  /** Read/write normalized progress 0..1. Getter returns 1 for a settled or reduced handle. */
  progress(p: number): this
  progress(): number
  /** Local elapsed time (ms), excluding repeats. */
  time(): number
  /** Total elapsed (ms), including repeats and repeatDelay. */
  totalTime(): number
  /** Duration (ms); undefined for an un-baked live spring/decay. */
  duration(): number | undefined

  // --- Physics only ---
  /**
   * Sample the deterministic trajectory to rest ONCE into a seekable table.
   * Idempotent; no-op on a tween or an already-baked handle. Returns true on
   * success, false (seekable stays false, warns once) if the motion never rests.
   */
  bake(options?: { maxDurationMs?: number }): boolean
  /** Live re-aim conserving current velocity. Warn once + no-op on a tween. The scroll-chase verb. */
  setTarget(value: number, options?: { velocity?: number }): this
}

export interface PlaybackOptions {
  /** ms before the clip starts, on the frame clock (background-tab-safe), scaled by timeScale. */
  delay?: number
  /** Iterations beyond the first. Infinity = forever (finished never resolves; stop() resolves it). */
  repeat?: number
  /** Dead time (ms) between iterations, on the frame clock. */
  repeatDelay?: number
  /** Ping-pong: a tween mirrors the curve, a spring alternates start<->target. Default false. */
  yoyo?: boolean
  /** Start under author control instead of auto-playing. Default false. */
  paused?: boolean
  /** Initial time scale. Default 1. */
  timeScale?: number
}
