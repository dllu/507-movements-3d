# Bevel tooth completeness — 2026-10-01

Reviewer: Codex (GPT-6), with independent read-only manual-builder and production
inventory audits by Codex subagents. The primary agent inspected movement 007
in the production browser beside its engraving, including both sides of the
gear cluster in close-up.

## Movement 007 correction

All three gears had lost tooth 0: A and B showed 17 of 18 teeth and C showed
21 of 22. The miter builder painted its index tooth white; the belt family's
source cleanup then detached it as an undrawn animation marker. The tooth
remained in `toothMeshes`, so the old array-length test missed its absence
from the rendered scene.

007 now asks the existing miter builder for ordinary teeth throughout
(`indexToothIndex: null`). Every tooth has the same material as the rest of
its wheel. Counts are 18, 18 and 22; there is no highlighted index tooth.
Tooth geometry, mesh phases, motion, and the default camera are unchanged.
The existing movement-7 regression now checks attachment to the rendered
rotor, visibility, and ordinary material for each tooth.

The focused movement-7 regression and 20 bevel, belt-family and presentation
checks pass. Actual tooth/body surface checks across a full turn, at 65 poses
and in both sampling directions for A–C and B–C, find minimum signed clearance
0.002415216 with no sampled penetration. This covers these working interfaces,
not the whole assembly or loaded tooth contact. Previous scoped belt seating
evidence remains in [the belt/clutch review](w2b-belts-clutches-review.md).

Browser inspection covers the default elevation, oblique view, both sides of
the mesh, and a turned pose; all three wheels have complete, uniformly colored
tooth rings. A 33-phase framing sweep has maximum normalized extent 0.90517
and no browser errors. Captures and surface measurements are outside Git in
`/dev/shm/bevel-teeth-007-review/` and
`/dev/shm/bevel-teeth-007-clearance.json`.

## Other bevel gears

A full 507-movement registry scan identified the authored bevel families,
followed by an audit of their actual asynchronous production routes. The
production inventory contains **81 wheels in 26 movements**, with **2,295
installed and visible teeth**. No other unintentionally missing teeth were
found. The audit checks rendered ancestry and inherited visibility, rather
than relying on `toothMeshes.length`, and checks angular spacing including the
last-to-first interval.

| Movement | Installed teeth on each production wheel |
| --- | --- |
| 007 | 18, 18, 22 |
| 025 | 36, 36 |
| 043 | 44, 44 |
| 049 | 40, 40, 40 |
| 053 | 40, 40, 40 |
| 061 | 26, 20, 26 |
| 062 | 34, 20, 34 |
| 074 | 32, 32, **20 on a 40-tooth pitch, intentional** |
| 087 | 30, 30, 42, 30, 36 |
| 161 | 36, 30 |
| 162 | 30, 30, 30, 30, 30 |
| 170 | 30, 30 |
| 200 | 24, 48, 32 |
| 226 | 20, 20, 20, 20, 20, 20 |
| 315 | 14 |
| 357 | 60, 12, 18, 18 |
| 366 | 32, 16 |
| 368 | 18, 30 |
| 372 | 18, 18, 18, 18 |
| 375 | 36, 18 |
| 411 | 18, 18 |
| 469 | 24, 24 |
| 495 | 20, 20, 20 |
| 503 | 48, 48, 28 |
| 506 | 20, 34, 36, 21, 13, 43, 16, 10 |
| 507 | 10, 10, 100 |

074's half-toothed driver is the deliberate source mutilation, not an omitted
index. Merged teeth in 061/062 were checked by geometry chunks and their
centroids; baked production replacements in 161/162/170 were checked separately
from their legacy factories. All five 30-tooth instance rings in 162 have
complete instance counts and closing angular intervals. The maximum spacing
error among the 80 complete rings is 1.13e-7 of a tooth pitch, arising from
Float32 instance transforms. The 100-tooth crown in 507 is included because it
uses the conical bevel builder. The legacy 163 model has bevels, but its actual
baked production model has none.

Other cleanup paths were also checked: gear-core recolors its painted bevel
index teeth, the governor index filters only disable shadows, and the
presentation hiding used by 503/506 only encounters separate decorative white
indicators on their bevels. Their working teeth remain attached and visible.

Detailed inventory and the temporary scanner are in
`/dev/shm/bevel-production-audit.json` and
`/dev/shm/bevel-production-audit.mjs`; the full legacy scan is
`/dev/shm/bevel-catalog-audit.json`. This is a completeness and spacing audit,
not a fresh visual approval or contact/intersection certificate for the other
movements. Their ledger assessments and remaining limitations are unchanged.

007 still uses prescribed analytic motion and selector engagement weights,
with no production MuJoCo. Loaded shifting, exact bevel conjugacy and friction
are unqualified. C's undrawn support, slight perspective and the ground shadow
retain the previously documented reconstruction limits.
