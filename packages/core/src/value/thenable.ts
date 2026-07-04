// Handles are PromiseLike<void>: `await animate(...)` / `await handle` resolves
// when the animation settles or is interrupted (never rejects, mirroring
// `finished`). The `then` on every handle delegates to its `finished` promise.

/** A PromiseLike `then` that resolves with void when the handle's `finished` does. */
export type ThenFn = <TResult1 = void, TResult2 = never>(
  onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
  onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
) => Promise<TResult1 | TResult2>

/** Build a handle's `then` from its `finished` promise (handles never reject). */
export const thenFinished =
  (finished: Promise<void>): ThenFn =>
  (onfulfilled, onrejected) =>
    finished.then(onfulfilled ?? undefined, onrejected ?? undefined)
