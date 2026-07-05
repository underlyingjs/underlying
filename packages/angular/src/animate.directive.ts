import { Directive, DestroyRef, ElementRef, NgZone, PLATFORM_ID, effect, inject, input, untracked } from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { animate, releaseStyle, type AnimateOptions, type AnimateTargets } from '@underlying/core'

/**
 * Reactively animate the host toward `[uAnimate]`. Whenever the bound targets
 * signal changes, the element springs to the new values - interruptible, velocity
 * conserved (a second call retargets the same live channels, never a restart). Bind
 * options once with `[uAnimateOptions]`. Inline styles are released on destroy.
 *
 * ```html
 * <div uAnimate [uAnimate]="{ x: open() ? 200 : 0 }" [uAnimateOptions]="{ stiffness: 320 }"></div>
 * ```
 */
@Directive({ selector: '[uAnimate]', standalone: true })
export class UnderlyingAnimateDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly zone = inject(NgZone)
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID))

  /** The channels to animate toward. Empty (the default, before binding) is a no-op. */
  readonly targets = input<AnimateTargets>({}, { alias: 'uAnimate' })
  readonly options = input<AnimateOptions>({}, { alias: 'uAnimateOptions' })

  constructor() {
    // The effect runs after inputs bind; it tracks `targets`, while `options` is
    // read untracked so only a value change re-fires the animation (config, not a
    // trigger). Empty targets animate nothing, so the initial no-bind pass is safe.
    // The spring runs outside the Angular zone so its frames don't trip change
    // detection, and is skipped off the browser (SSR), where there is no DOM.
    effect(() => {
      const targets = this.targets()
      if (!this.isBrowser || Object.keys(targets).length === 0) return
      this.zone.runOutsideAngular(() => animate(this.host, targets, untracked(this.options)))
    })
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser) releaseStyle(this.host)
    })
  }
}
