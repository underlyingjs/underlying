import { DestroyRef, NgZone, PLATFORM_ID, inject } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'

/**
 * Wire a primitive to a directive's lifecycle. Call this in an injection context
 * (a field initializer) to capture the zone / platform / destroy hooks, then
 * invoke the returned binder from `ngOnInit`, once the input signals hold their
 * bound values.
 *
 * The primitive is created via `NgZone.runOutsideAngular`, so its animation frame
 * loop and pointer listeners never trip change detection (a zoned app would
 * otherwise run change detection on every frame and every pointermove). It is
 * skipped entirely off the browser (SSR), where there is no DOM to bind. The
 * returned `teardown` runs on destroy.
 */
export function primitiveBinder(): <H>(create: () => H, teardown: (handle: H) => void) => void {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID))
  const zone = inject(NgZone)
  const destroyRef = inject(DestroyRef)
  return (create, teardown) => {
    if (!isBrowser) return
    const handle = zone.runOutsideAngular(create)
    destroyRef.onDestroy(() => teardown(handle))
  }
}
