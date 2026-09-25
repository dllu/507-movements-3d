# Pass 55 water lane (p55-water)

Scope: water drawn as bundles of thin tubes or droplet spheres (433, 438, 444,
461, 464), the dark blob capping 446's column, the stray block in 451's pipe,
463's overflow and unsupported head-water face, the discharge discs over the
mouths of 475/476, and a sweep of the other hydraulic plates for the same
kinds of fault. Casings of the pump family belong to the concurrent
p55-cutaway lane; only water parts were edited here.

## Shared helper

`src/simulation/water-volume.js` gained moving-water bodies next to the
existing still-water volume:

- `waterJetMaterial()` - translucent fluid material (opacity < 0.6, so the
  solid-clearance screens treat it as fluid) with per-vertex alpha.
- `waterJetGeometry(curve, options)` - one elliptic-section water body swept
  along its trajectory. Thickness and width taper independently along an
  optional width axis (a round jet, a sheet or a fan); past `fadeStart` the
  section flares while its alpha falls to zero, which gives modest spray at
  the end of a jet without particles. Optional `thetaStart/thetaLength` cut it
  to a sector with flat cut faces (for jets inside a cutaway).
- `waterFountainGeometry(options)` - a column rising to its apex and a thin
  two-skin crown of ballistic (linear-radius, quadratic-fall) sheet falling
  back, fading at the rim. It can be cut to a sector or split between meshes.

## Per movement

| ID | Before | After |
| --- | --- | --- |
| 433 | Jet = five thin tubes; droplet spheres falling below | One sheet across the spout width following the fall onto the far blades; the water continues as a thinning falling sheet below the struck blades (Brown's spray); droplet markers hidden |
| 438 | Four hose-like solid tubes (opacity 0.67) | Four translucent jets opening into drooping fans that fade out; the inlet fall from the flume is the same kind of body |
| 444 | Fourteen thin arc tubes + 28 droplet spheres | One column and a thin ballistic crown falling back round it, fading at the rim; droplets and their arcs deleted |
| 446 | Dark opaque lens-shaped ellipsoid over the column | A small pale crown heaving up out of the upper surface and falling back into it (gated on as before) |
| 451 | Square block in the pipe | Not water: it is the square port window of the barrel wall seen through the pipe. Left to the p55-cutaway lane, which owns the barrel (`portedBarrel` in `force-pump-working-parts.js`) |
| 461 | Four thin cylinders | One translucent jet leaving the top spout, curving down and opening into a fading fan; it follows the swinging outlet and grows with the discharge fraction |
| 463 | Overflow a flattened tube 0.14 deep; head water a box ending at x = 0, standing with a vertical face when the upper leaf leans (the clipped wedge never showed) | The head water is one prism whose section follows the leaves: up the lower leaf's upstream face, over its top, down to the upper leaf's bearing edge and up the upper leaf's upstream face to the free surface, rebuilt in place each frame (fixed topology). The notch overflow is a sheet the notch wide, level with the head at the crest, spreading and breaking into spray where it lands. Ordinary head raised from 0.14 to 0.24 above the notch sill so the nappe reads as a sheet |
| 464 | Two sides of ~16 thin streak tubes | Column from the spire tip and a two-half ballistic crown (left and right spray meshes) scaled with the pressure head; spray opacity capped at 0.5 |
| 475 | Stubby translucent capped cylinder over C's mouth; full free-surface disc sticking out of the cut chamber | The discharge wells up out of C and spills over the lip as a sheet running down the outside, cut to the half behind the section plane like C itself; the free surface is a half disc |
| 476 | Same capped cylinder | Same welling overflow, whole (the fork is opaque and uncut) |

Sweep of the other hydraulic plates (430-464 captured at five views each):

- 430: the feed was an opaque-looking flattened tube; now a translucent sheet
  the width of the flume water, fading into the buckets.
- 435: a ring of discharge water hung free below the open runner centre,
  reading as a pale disc; not in Brown's plan. Removed through
  `source-presentation.js` (test updated).
- 439: the fall from the flume was a solid-looking rod (opacity 0.68); now a
  translucent stream narrowing as it falls.
- 448: the spout discharge was a short tapered cylinder ending flat in mid-air;
  now a falling stream hung from the spout lip that thins and fades.
- No tube bundles or floating discs found in 431, 432, 434, 436, 441, 442,
  443, 449, 453, 460, 462 (water there is volumes or single sheets).

## Checks

Captures (default phase 0 and 0.5, rotated +60 and -110, top/behind) were
inspected for every changed ID before and after; zoomed crops for 444, 446,
461, 463, 464.

Tests run (all pass unless noted): movement-430, 433, 435 (updated), 438, 439,
444, 445, 446, 448, 449, 461, 463 (updated: head-water bounds instead of box
scale), 464, 475, 476; chain-weir-interfaces, oscillating-column-working-
interfaces, water-mechanism-439-440-444-solids, water-wheel-430-432-solids,
turbine-433-435-solids, fluid-rotor-436-438-solids, well-scoop-gutter-solids,
lift-pump-working-solids, reviewed-cycle-timing, movement-453.
Failures seen in the same run belong to the cutaway lane's in-progress work:
ejector-trap-working-solids (477 seat winding), movement-481 and the
source-presentation 481 geometry check.

Relative-motion screens (`show-body-intersections`, 0.01 spacing, 129 poses;
463 at 65 poses): no solid pairs above 0.0001 in 430, 435, 438, 444, 446, 448,
461, 463, 464, 475, 476 (only zero-depth seated contacts: 444 waste valve disk,
448 foot valve, 463 deposit/bed coaxial). All new jets, crowns and head water
are fluid (opacity < 0.6). The 439 screen runs out of heap (4 GB) before
reporting, so 439 stays at its focused-test evidence.

## Residuals

- Jets and crowns are shaped bodies on prescribed paths, not solved free
  surfaces; the spray is an alpha fade, not particles.
- 438's jets turn rigidly with the runner (a real jet leaves in the lab frame).
- 463's head water is a prism across the full gate width; the notch region of
  the upper leaf is not carved out of it.
- 433's spout still has no visible support (not water; left for a support
  pass).
- 451's square port is barrel geometry (cutaway lane).
