---
"@underlying/flip": minor
---

`flipGroup()` - automatic layout, shared-element, and enter/exit transitions for a container, all on the interruptible flip spring (#55):

```ts
const group = flipGroup(list)

group.flip(() => reorder(list))   // auto-FLIP: every survivor springs to its new box
group.add(row)                    // enter
group.remove(row, { mode: 'pop' })// exit: the gap closes instantly while the row springs out on top
```

- **Auto-FLIP** - `group.flip(mutate)` brackets a layout edit and springs every affected child from its old box to its new one, so a reorder/insert/resize animates with one call, no manual snapshot.
- **Presence (enter / exit)** - `add()` springs a new node in; `remove()` keeps the node mounted until its exit spring settles, then detaches it. Modes: `sync` (overlap), `wait` (the enter holds until the exit finishes), `pop` (the exiting node leaves layout flow so the rest reflows immediately while it animates out). A re-add mid-exit retargets the live springs and cancels the removal - it bends back, never restarts.
- **Shared-element** - two nodes that share a `data-flip-id` animate one from the other's box across mount/unmount and across containers, so a thumbnail flies into a detail hero with no crossfade.

Held still under reduced motion (it settles straight to the final layout, no jump). The existing `flip()` / `snapshot()` / `play()` are unchanged, and a consumer that imports only those still tree-shakes the controller away.
