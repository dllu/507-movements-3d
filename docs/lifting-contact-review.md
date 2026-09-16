# Stone-lifting contact pass: 493–494

Primary references: [493](https://507movements.com/mm_493.html) and
[494](https://507movements.com/mm_494.html), checked 2026-09-15 together with their
engravings and inline canvas models. Both official animations run at 15 cycles
per minute. Their existing source-derived coordinates, piecewise-linear stage
laws, four-second cycles and dwell landmarks are preserved.

## Published corrections

**493:** Working taper and stone-bore faces no longer expand into one another
through bevels. The dark bore walls and floor lie outside the actual contact
boundary; packing face pads lie inside their packing instead of protruding into
the stone. The shackle pin now passes through a real hole in the wedge head and
bored clevis arms. A transverse bow joins those arms, retaining a finite load path
to the hoist rope. Existing wedge spread and stone lift remain unchanged.

**494:** Both tong upper arms and both upper links now use shared bored planar
members. Separate axial layers and the longer common shackle pin provide real
clearance at the crossed fulcrum and all three upper joints. The shackle neck has
a true pin eye. The curved jaw tubes end behind the pointed tips, and those tips
face inward at contact; the previous round tube ends penetrated the stone around
the mathematical bite point. The stone no longer has a bevel expanding across
the source bite boundary, and decorative solid seat markers are hidden.

Both models use full-cycle bounds, source-facing cameras and no generic ground
or material fog. The construction reuses bored-link, finite-plate and framing
helpers; analytical constraints remain sufficient for this unloaded prescribed
motion.

## Evidence and limits

`node --test tests/movement-493.test.mjs tests/movement-494.test.mjs tests/lifting-contact-solids.test.mjs`

18 tests pass: 16 existing source/analytic checks and two independent finite-solid
sweeps. At 65 poses the actual triangle surfaces qualify taper/packing/bore
clearance, shackle-pin bores, tong/stone clearance and all pin/member interfaces.
The 493 source coordinates are rounded, so its taper test allows 2e-6 scene units.
These are bounded samples, not exhaustive collision proofs.

Chrome default/front/raised review reported no errors or clipping over 17 poses.
Maximum absolute projected coordinates were .896 for 493 and .884 for 494.
Captures and downloaded canvas sources are kept in `/dev/shm`.

Stone friction, elastic deformation, grip strength and lifting capacity remain
unsolved. Stone motion is prescribed by the official animation after geometric
contact; this pass does not establish that a particular friction coefficient or
material would safely support the load. Clevis depth and pin clearances are
reconstruction choices rather than dimensions specified by Brown.

## Queued: 389 jack handoff

**Follow-up:** the twenty-sixth pass integrates the corrected finite handoff and
source proportions; see [the 389 contact review](jack-389-contact-review.md).
The notes below preserve the earlier experiments and their then-open issues.

389 was reviewed but **is not changed in this published pass**. Its original
point-law pawls do not establish a continuous finite-pawl handoff. A candidate
bored eccentric/strap/support reconstruction passed finite collision samples,
but a denser motion scan caught a discontinuous pawl branch change. That candidate
is preserved on the [separate WIP branch](https://github.com/dllu/507-movements-3d/tree/codex/389-finite-pawl-wip)
(commit `5d710e2`, with resume notes and candidate tests); publishing 493–494 does not claim to
resolve it. The next pass must qualify continuity and overtravel together, while
keeping prescribed preload and unloaded reset distinct from validated dynamics.

A subsequent bounded experiment is preserved on
[`codex/389-continuous-pawl`](https://github.com/dllu/507-movements-3d/tree/codex/389-continuous-pawl)
(commit `1a4025d`). It identifies the disconnected feasible pawl-angle intervals
and uses sufficient overtravel to connect them before seating. Three experimental
tests pass, including full-cycle travel bounds at 32,768 and 65,536 samples.
Production 389 remains unchanged: the reduced tooth pitch needs source review,
and four legacy motion assertions still require reconciliation with the proposed
settling/reset law. This experiment does not establish passive contact dynamics.
