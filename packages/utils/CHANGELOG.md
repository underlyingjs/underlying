# @underlying/utils

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

- First stable release. Named ease families and helpers (clamp, mapRange, interpolate, snap, wrap, random...), tree-shakeable, with a `/register` entry for string eases. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies [c4dd1e9]
  - @underlying/core@0.1.0-beta.6

## 0.1.0-beta.1

### Minor Changes

- a27ed4d: Initial beta of `@underlying/utils`: the named-ease and helpers layer for `@underlying/core`. The full named-ease library (`power1-4`, `sine`, `expo`, `circ`, `back`, `elastic`, `bounce`, `steps`) plus `cubicBezier` - each a plain function you can pass directly (`easing: power2.out`), or by string (`'power2.out'`, `'elastic.out(1, 0.3)'`) after `import '@underlying/utils/register'` so existing ease-name code ports across unchanged. Plus the helpers `clamp`, `mapRange`, `interpolate`, `snap`, `wrap`, `random`, `toArray`, `pipe`. Tree-shakeable, ~1.3 kB gzip. Springs already replace back/elastic/bounce for LIVE motion - this layer is for baked tweens, scrubbable timelines, and ports.

### Patch Changes

- Updated dependencies [a27ed4d]
  - @underlying/core@0.1.0-beta.5
