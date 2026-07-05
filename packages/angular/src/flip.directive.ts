import { Directive, DestroyRef, ElementRef, inject, input, type OnInit } from '@angular/core'
import { reorder, type ReorderOptions } from '@underlying/flip'

/**
 * Drag-to-reorder the host's children. `<ul uReorder [uReorder]="{ handle: '.grip' }">`.
 * Disposes on destroy.
 */
@Directive({ selector: '[uReorder]', standalone: true })
export class UnderlyingReorderDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly destroyRef = inject(DestroyRef)
  readonly options = input<ReorderOptions>({}, { alias: 'uReorder' })
  ngOnInit(): void {
    const handle = reorder(this.host, this.options())
    this.destroyRef.onDestroy(() => handle.dispose())
  }
}
