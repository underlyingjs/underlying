import { Directive, ElementRef, inject, input, type OnInit } from '@angular/core'
import { draggable, type DraggableOptions } from '@underlying/gestures'
import { primitiveBinder } from './internal'

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
  private readonly bind = primitiveBinder()

  /** Options passed to `draggable()` - read once at init. */
  readonly options = input<DraggableOptions>({}, { alias: 'uDraggable' })

  ngOnInit(): void {
    this.bind(
      () => draggable(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}
