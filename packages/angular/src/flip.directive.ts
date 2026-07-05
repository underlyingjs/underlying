import { Directive, ElementRef, inject, input, type OnInit } from '@angular/core'
import { reorder, type ReorderOptions } from '@underlying/flip'
import { primitiveBinder } from './internal'

/**
 * Drag-to-reorder the host's children. `<ul uReorder [uReorder]="{ handle: '.grip' }">`.
 * Disposes on destroy.
 */
@Directive({ selector: '[uReorder]', standalone: true })
export class UnderlyingReorderDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<ReorderOptions>({}, { alias: 'uReorder' })
  ngOnInit(): void {
    this.bind(
      () => reorder(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}
