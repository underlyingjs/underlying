---
"@underlying/scroll": patch
---

Republish. `0.1.0-beta.1` shipped with an unresolved `workspace:*` spec for its `@underlying/core` dependency (it was published with `npm`, which does not rewrite the workspace protocol, instead of `pnpm`), so installing it from the registry failed. This release ships the resolved dependency range plus the package README and LICENSE. `0.1.0-beta.1` is deprecated.
