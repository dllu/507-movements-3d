# Movement 148: geared alternating crank (review in progress)

The [source](https://507movements.com/mm_148.html) says the continuously rotating
spur gears produce alternating crank rotation. The page marks its animation
unavailable. The engraving shows a long oblong guide; the existing reconstruction
uses circular rails attached to a short four-bar coupler. That interpretation and
the complete linkage geometry remain under review.

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
Keep 148's review open after this gear/display checkpoint.

## Candidate oblong rocking frame

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
crank, eccentric mounting arm, pins, retainers and stub shaft. All 1,332,500
sampled point/solid checks clear a `1e-6` penetration tolerance. This does not
include complete gears, their bearings or the fixed supporting frame. Two
focused tests verify the continuous full-turn closure and actual joint bores,
with pin clearance above 0.0027 units.

Source, quarter-turn and half-turn candidate renders were inspected with the
existing gears as a visual reference. The source silhouette is substantially
closer, but the candidate is not registered. Next: integrate proper bored gear
hubs and supports, check the complete assembly, and decide whether this inferred
frame arrangement is sufficiently supported for replacement. The browser still
uses the circular-guide reconstruction pending that work.
