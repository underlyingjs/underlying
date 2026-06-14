/**
 * Smoothed pointer velocity in units/s over a ~50 ms window. The smoothing is a
 * first-order EMA made frame-rate independent (alpha = 1 - exp(-dt/0.05)), and
 * read() returns 0 if the last sample is older than 80 ms - a finger that paused
 * before lifting releases with no fling. Feed it the same clock (event.timeStamp)
 * for start/sample/read.
 */
export class VelocityTracker {
  private value = 0
  private lastPosition = 0
  private lastTimeMs = 0

  start(position: number, timeMs: number): void {
    this.value = 0
    this.lastPosition = position
    this.lastTimeMs = timeMs
  }

  sample(position: number, timeMs: number): void {
    const dt = (timeMs - this.lastTimeMs) / 1000
    if (dt <= 0) return
    const instantaneous = (position - this.lastPosition) / dt
    const alpha = 1 - Math.exp(-dt / 0.05)
    this.value += (instantaneous - this.value) * alpha
    this.lastPosition = position
    this.lastTimeMs = timeMs
  }

  read(timeMs: number): number {
    return timeMs - this.lastTimeMs > 80 ? 0 : this.value
  }
}
