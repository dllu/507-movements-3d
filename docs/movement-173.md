# Movement 173: tappet-indexed silk traverse — source review open

The browser now uses a 42-mesh reconstruction driven by a 42,116-byte MuJoCo
motion bake. The visible screw, traveling nut and slotted guide replace the
legacy prescribed indexing curve and oversized frame. A four-second disk turn
indexes the passive wheel by one tooth. The finite adjustment lasts 71.825
seconds from the source pose and stops without wrapping the nut back.

The [original page](https://507movements.com/mm_173.html) has no enabled 2D
animation. Its engraving and caption are the source reference.

## Reconstruction and assumptions

The disk, diagonal screw channel, rounded vertical yoke, horizontal guide and
separate upper/lower supports follow the engraving. Initial wrist and rod-end
centers fit within 1.03 pixels; the selected wheel center fits exactly. The
screw uses a finer, inferred 0.12 lead, consistent with the closely spaced
thread marks. The nut follows the corresponding ideal right-hand helix law.
Its internal thread, bearings and guide constraints are ideal; the modeled
screw resistance is inferred rather than derived from a silk load.

Only the disk carrier is actuated in MuJoCo. Normal contact with the fixed
spherical tappet drives the 18 straight wheel teeth; there is no output
actuator, angle clamp or prescribed indexing curve. Tooth geometry, pin height,
initial phase, inertia and resistance remain reconstruction assumptions.
A small contact margin initiates the response before finite surfaces overlap.

Depths are inferred where the engraving omits them. The guide lies in front of
the wheel's swept volume, with real bores through the screw bearings, nut and
horizontal guide bearing. The fixed tappet has a forward stem and supporting
arm. The overall base and rear A-frame from the old model have been removed.
Fog and ground are disabled; Restart restores the exact source pose.

## Evidence

- [Native qualification](validation/173-native-tappet.json): 18 turns at 50 and
  25 microsecond timesteps, one tooth per turn, no backward motion, and zero
  wheel rotation when tappet contact is disabled.
- [Bake](validation/173-tappet-bake.json): 144,001 recorded samples reduced to
  2,090 adaptive keys, with maximum angle error below 4.72e-7 radians at those
  samples. No MuJoCo/WASM is loaded for browser playback.
- [Dense contact clearance](validation/173-tappet-baked-clearance.json): 16,712
  interpolated poses have positive finite wheel-to-tappet clearance. The common
  rigid transformation used to place that component preserves this clearance.
- [Assembly clearance](validation/173-assembly-clearance.json): all 42 physical
  meshes classified; 521 cross-body pairs at 129 adjustment poses, with
  239,760,232 surface queries and no sampled intersections. This is a sampled
  sweep, not a continuous collision proof.
- Four tests pass: native/visible tooth centers, axes and dimensions; finite
  monotone playback; source landmarks; and complete-assembly nut lead, guide
  constraint, finite transforms and reset.
- Production build and [desktop/mobile browser checks](validation/173-browser.json)
  pass playback, exact Restart, orbit/reset view, viewport overflow, no WASM
  requests and no page errors. Front and oblique views were inspected.

## Remaining source-fit work

The wheel silhouette is still too small. Its projected bounds are approximately
[340.43, 154.77, 383.57, 219.23], versus manually measured engraving bounds
[331, 146, 393, 229]. See [source fit](validation/173-source-fit.json). Revise its
native and visible dimensions together, then regenerate and requalify the bake
and full-assembly clearance. Do not mark 173 reviewed until that discrepancy
and the final visual comparison are resolved.

The original incorrect model remains in the synchronous legacy registry.
The historical [baseline](validation/173-existing-contact.json) and
[post-render-fix audit](validation/173-current-contact.json) describe that model,
not the current browser implementation. They exposed tappet overlap in 185 of
257 poses, which its former nominal-radius tests missed.
