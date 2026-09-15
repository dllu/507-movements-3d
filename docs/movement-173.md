# Movement 173: tappet-indexed silk traverse

The browser now uses a 42-mesh reconstruction driven by a 51,130-byte MuJoCo
motion bake. The visible screw, traveling nut and slotted guide replace the
legacy prescribed indexing curve and oversized frame. A four-second disk turn
indexes the passive wheel by one tooth. The finite adjustment lasts 71.825
seconds from the source pose and stops without wrapping the nut back.

The [original page](https://507movements.com/mm_173.html) has no enabled 2D
animation. Its engraving and caption are the source reference.

## Reconstruction and assumptions

The disk, diagonal screw channel, rounded vertical yoke, flanged horizontal guide and
separate upper/lower supports follow the engraving. Initial wrist and rod-end
centers fit within 1.03 pixels; the selected wheel center fits exactly. The wheel bounds fit within 2.1 pixels of the measured outline. The
screw uses a finer, inferred 0.12 lead, consistent with the closely spaced
thread marks. The nut follows the corresponding ideal right-hand helix law.
Its internal thread, bearings and guide constraints are ideal; the modeled
screw resistance is inferred rather than derived from a silk load.

Only the disk carrier is actuated in MuJoCo. Normal contact with the fixed
spherical tappet drives the 18 straight wheel teeth; there is no output
actuator, angle clamp or prescribed indexing curve. Tooth geometry, pin height,
initial phase, inertia and resistance remain reconstruction assumptions.
A small contact margin initiates the response before finite surfaces overlap.

Depths are inferred where the engraving omits them. The near-orthographic front view preserves the source proportions. The tall
guide flange lies in front of
the wheel's swept volume, with real bores through the screw bearings, nut and
horizontal guide bearing. The fixed tappet has a forward stem and supporting
arm. The overall base and rear A-frame from the old model have been removed.
Fog and ground are disabled; Restart restores the exact source pose.

## Evidence

- [Native qualification](validation/173-native-tappet.json): 18 turns at 50 and
  25 microsecond timesteps, one tooth per turn, no backward motion, and zero
  wheel rotation when tappet contact is disabled.
- [Bake](validation/173-tappet-bake.json): 144,001 recorded samples reduced to
  2,558 adaptive keys, with maximum angle error below 4.99e-7 radians at those
  samples. No MuJoCo/WASM is loaded for browser playback.
- [Dense contact clearance](validation/173-tappet-baked-clearance.json): 20,456
  interpolated poses have positive finite wheel-to-tappet clearance. The common
  rigid transformation used to place that component preserves this clearance.
- [Assembly clearance](validation/173-assembly-clearance.json): all 42 physical
  meshes classified; 521 cross-body pairs at 129 adjustment poses, with
  239,749,964 surface queries and no sampled intersections. This is a sampled
  sweep, not a continuous collision proof.
- Four tests pass: native/visible tooth centers, axes and dimensions; finite
  monotone playback; source landmarks; and complete-assembly nut lead, guide
  constraint, finite transforms and reset.
- Production build and [desktop/mobile browser checks](validation/173-browser.json)
  pass playback, exact Restart, orbit/reset view, viewport overflow, no WASM
  requests and no page errors. Front and oblique views were inspected.

## Source comparison and review status

The wheel and its native contact geometry were enlarged together. Its projected
bounds are [333.09, 144.57, 390.91, 229.43], against manually measured engraving
bounds [331, 146, 393, 229]. The maximum boundary difference is 2.10 pixels.
See [source fit](validation/173-source-fit.json). These selected measurements
and the inspected front/oblique views support the reconstruction; they are not
an automated registration of every engraving contour. The source leaves
support depths, bearing construction and tooth details to reconstruction.

The wheel, contact bake and complete assembly have been requalified together.
Movement 173's review is complete with the stated assumptions. Next source
review: 174; the full 507-movement review remains active.

The original incorrect model remains in the synchronous legacy registry.
The historical [baseline](validation/173-existing-contact.json) and
[post-render-fix audit](validation/173-current-contact.json) describe that model,
not the current browser implementation. They exposed tappet overlap in 185 of
257 poses, which its former nominal-radius tests missed.
