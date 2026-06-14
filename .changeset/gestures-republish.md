---
"@underlying/gestures": patch
---

Republish for provenance. `0.1.0-beta.1` was published by hand during the package bootstrap, so - unlike the rest of the family - it shipped without a SLSA provenance attestation. It installs correctly (its `@underlying/core` dependency is a resolved version, not a raw `workspace:*`), so it is not deprecated: this release is the same surface, rebuilt and published by CI over OIDC so it carries provenance like core, scroll, timeline and text.
