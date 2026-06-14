/** Shared leaf type: every builder (scrub/pin/snap/trigger) returns one. */
export interface Disposable {
  dispose(): void
}
