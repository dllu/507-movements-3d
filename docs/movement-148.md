# Movement 148: reconstructed oblong-frame crank-rocker

The browser now uses `geared-crank.js`: a traced oblong rocking frame, bored short
crank, eccentric mounting arm, 12/48 involute gears, bored hubs and rear supports.
Motion is analytic, with an eight-second large-gear turn and a two-second pinion
turn. No physics runtime or bake is necessary for this closed four-bar geometry.
The upper joint is shifted 14 pixels right to permit continuous input rotation.
Treating the oblong as part of the long rocker and placing the supports behind
it are explicit engineering assumptions, not a definitive reading of Brown's
brief caption. Exact historical topology remains uncertain.

The complete 27-part assembly passes 65 sampled configurations: 241 pairs from
different rigid families and 9,109,060 point/solid checks, with no penetration
above `1e-6`. [Assembly evidence](validation/148-assembly.json) includes both
gears, shafts, hubs, frame, cranks, pins and retainers. A separate
[257-pose tooth check](validation/148-complete-teeth.json) finds no overlap.
Four focused tests cover full-turn closure, real pin and axle bores, framing,
fog removal and restart. These sampled checks do not establish continuous
swept-volume clearance or prove the historical interpretation.
The production build and packaged desktop/mobile test pass, including exact
restart, orbit/reset-view controls and no WASM request. Final front, moving,
oblique and mobile renders were inspected.

## Original drawing and legacy reconstruction

The [source](https://507movements.com/mm_148.html) says the continuously rotating
spur gears produce alternating crank rotation. The page marks its animation
unavailable. The engraving shows a long oblong member; the old reconstruction
used circular rails attached to a short four-bar coupler. That implementation is
retained for diagnostics but is no longer registered for browser playback.

## Gear and display improvements

The 12/48-tooth gears now use the shared involute profile, with inset chamfers
that do not expand the teeth. Root depth exceeds the mating addendum, correcting
the old tip/root interference. [Tooth evidence](validation/148-teeth.json) checks
the central tooth outlines at 257 poses through a complete large-gear turn and
four pinion turns, with zero overlap. Coordinates are rounded to `1e-9` for
polygon clipping stability. This checks teeth, not hubs, shafts or linkage parts.
The existing shallow tooth height, gear ratio and eight spokes remain inferred
from the illustration; the teeth are not a standard full-depth cutter profile.

The large gear now takes eight seconds per turn instead of about 20.94; the
pinion takes two seconds. The initial view is nearly frontal, fog remains
disabled, and the ground plane is hidden. The analytical linkage test passes
with a slightly larger floating-point tolerance for radial velocity at the
higher speed (`2e-15` rather than `3e-16`). That test establishes closure of the
current chosen linkage dimensions, not agreement with the source. The production
build and packaged desktop/mobile check pass, including the newly enabled
Restart control, exact initial-frame restoration, orbit/reset-view controls and
no WASM request. Front, moving, oblique and mobile renders were inspected.

## Source geometry still unresolved

[Landmark evidence](validation/148-source-linkage.json) reads approximate pixel
centers from the 525-pixel engraving: gear `(263,288)`, left pin `(212,264)`, upper
joint `(247,228)`, and fixed right pivot `(469,258)`. Interpreting these as the
existing four-bar gives lengths about 56, 50, 224 and 208 pixels. Circle closure
fails at 92 of 360 sampled input angles, with a maximum deficit near 22 pixels.
The current implementation changes these proportions to make a crank-rocker
complete every revolution.

This is evidence against directly copying those landmarks into the existing
four-bar model, not proof that Brown's mechanism cannot work. The roles of the
pins and oblong guide need to be resolved before reconstructing its shape.
Actual bores, pin attachment and whole-assembly interference are also unchecked.
These findings motivated the reconstructed arrangement below.

## Oblong frame interpretation and depth arrangement

A separate candidate in `geared-crank-frame.js` traces the outer and inner
boundaries of the oblong and treats it as a structural part of the long rocker.
The short crank joins the eccentric pin to the upper frame joint. This topology
is an engineering interpretation, not established by the brief caption. The
[Cornell scan of Brown's original plate](https://ecommons.cornell.edu/server/api/core/bitstreams/4cfb6186-33d5-423a-86d9-7c02924f3130/content)
was also inspected; it repeats the same arrangement without further explanation.
No animation reference for 148 was found on the original site or in YesYen's
page-17 animation metadata.

The candidate retains the measured gear center, eccentric pin and right pivot,
but shifts the upper joint 14 pixels right, from `(247,228)` to `(261,228)`.
That gives a complete analytic crank-rocker cycle, with no change of closure
branch or angle discontinuity. The oblong is carried by the long rocker rather
than by the short crank as in the current browser model. Its boundary is traced
independently of the joint adjustment.

[A through-shaft check](validation/148-rocking-frame.json) rejects a gear shaft
extending through this frame: a 0.2-radius section collides at 153 of 257 poses.
The candidate therefore has a rear-supported stub shaft ending at Z=0.18;
the oblong plate starts at Z=0.40. The short crank lies between them, with real
bores receiving the eccentric and frame-joint pins. Pins have retainers clear of
the moving plates. The depth arrangement and unloaded prescribed input are
explicit reconstruction assumptions.

[Candidate assembly evidence](validation/148-frame-assembly.json) checks ten
parts and 36 pairs from different rigid families at 65 poses: the frame, short
crank, eccentric mounting arm, pins, retainers and stub shaft. All 1,307,540
sampled point/solid checks clear a `1e-6` penetration tolerance. This does not
include complete gears, their bearings or the fixed supporting frame. Two
focused tests verify the continuous full-turn closure and actual joint bores,
with pin clearance above 0.0027 units.

Source, quarter-turn and half-turn candidate renders were inspected with the
existing gears as a visual reference. The complete replacement now has a thinner
gear rim, a source-sized central hub, rear frame panels and rail, and actual hub
bores. Its frame-joint pin starts at Z=0.195 to clear the central shaft retainer
ending at Z=0.185. Pin shafts terminate within their retainers so duplicate
coplanar faces do not flicker. The short crank has a narrow shank and bored eyes.

The full check is reproducible with `FULL_ASSEMBLY=1` for
`scripts/review-geared-crank-frame-assembly.mjs` and
`scripts/review-geared-crank-teeth.mjs`. The original through-shaft rejection and
smaller prototype check remain separate evidence. The new motion follows the
caption and the traced outline substantially more closely than the circular
guide, with the topology, joint shift and depth assumptions disclosed above.
