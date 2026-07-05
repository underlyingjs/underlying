import { Directive, DestroyRef, ElementRef, inject, input, type OnInit } from '@angular/core'
import { draggable, type DraggableOptions } from '@underlying/gestures'

/**
 * Make the host element draggable. Bind options via `[uDraggable]`; the drag
 * disposes automatically when the element is destroyed.
 *
 * ```html
 * <div uDraggable [uDraggable]="{ axis: 'x' }"></div>
 * ```
 */
@Directive({ selector: '[uDraggable]', standalone: true })
export class UnderlyingDraggableDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly destroyRef = inject(DestroyRef)

  /** Options passed to `draggable()` - read once at init. */
  readonly options = input<DraggableOptions>({}, { alias: 'uDraggable' })

  ngOnInit(): void {
    const handle = draggable(this.host, this.options())
    this.destroyRef.onDestroy(() => handle.dispose())
  }
}
