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
