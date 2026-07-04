---
"@underlying/svg": minor
---

Harden `morphCommands()` past the v1 pipeline (#46). No API change - the same
command-preserving morph, now robust on shapes it used to reject or handle poorly.

- **Arcs.** Elliptical arc commands (`A`/`a`) convert to cubic beziers (endpoint
  -> center, split into <=90 degree segments) instead of throwing. The flag-aware
  parser also reads packed arc flags (`A5 5 0 0110 10`).
- **Arc-length subdivision.** When matching two shapes' segment counts, the sparser
  one is split by ARC LENGTH at each segment's arc-length midpoint, not by chord at
  the parametric midpoint - so a curvy segment that folds back is divided fairly.
- **Normalized correspondence.** Closed rings are aligned (rotation + winding) on
  centroid/scale-normalized anchors, so a large difference in size or position no
  longer swamps the rotational match and spin/inside-out flips it.
- **Similarity subpath matching.** Multi-piece shapes pair each subpath to its most
  similar counterpart (centroid + area), not by authoring order. Surplus pieces
  collapse to / grow from their own centroid point, so an extra piece shrinks away
  or appears cleanly instead of being padded with an unrelated shape.

As-rigid-as-possible interpolation is still deferred; `morph()` (resampling) remains
the fallback for arbitrary shapes where corner preservation does not matter.
