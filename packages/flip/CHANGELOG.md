# @underlying/flip

## 1.1.0

### Patch Changes

- Updated dependencies [7733826]
- Updated dependencies [786aca7]
- Updated dependencies [cf994f5]
- Updated dependencies [3f85820]
  - @underlying/core@1.1.0

## 1.1.0-beta.4

### Patch Changes

- Updated dependencies [7733826]
- Updated dependencies [786aca7]
- Updated dependencies [cf994f5]
- Updated dependencies [3f85820]
  - @underlying/core@1.1.0-beta.4

## 1.1.0-beta.3

### Patch Changes

- @underlying/core@1.1.0-beta.3

## 1.1.0-beta.2

### Patch Changes

- @underlying/core@1.1.0-beta.2

## 1.1.0-beta.1

### Patch Changes

- @underlying/core@1.1.0-beta.1

## 1.1.0-beta.0

### Patch Changes

- @underlying/core@1.1.0-beta.0

## 1.0.0

- First stable release. `flip()` inverts position and size in one pass and springs to identity, interruptibly; `snapshot()`/`play()` for shared-element transitions. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.1

### Minor Changes

- b88136b: Initial beta of `@underlying/flip`: layout and shared-element transitions on the live physics of `@underlying/core`. `flip(targets, mutate)` measures each element's box before and after a DOM change and springs it from old to new - both position AND size (translate + scale, pinned to the top-left) - so nothing jumps. `snapshot(targets)` + `play(snapshot, { targets })` do the same across two different DOM states matched by `data-flip-id`, for shared-element and route transitions. The play is a spring, not a baked tween: call it again mid-flight and each element retargets from its live position and velocity, so the motion bends into the new layout instead of restarting. About 0.9 kB gzip on top of core.
