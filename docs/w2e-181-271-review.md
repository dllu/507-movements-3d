# Pass-51 wave-2 lane w2e-181-271 review

Scope: the pass-51 audit items for 175, 176, 181, 182, 190, 219–224, 246–253 and
260–271 (see `docs/visual-audit-pass51.md`). Every change was checked against
`public/engravings/mm_NNN.png` using `scripts/review-movement-source-views.mjs`
(default and oblique views), and swept with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Intersection depths are model units; "clear" means no reported pair.

## Camera and layout corrections

| ID | Change | Intersections before → after |
|---|---|---|
| 260 | Edge-on side elevation (shafts horizontal, gears edge-on); tighter fit; white shaft index bars hidden. | clear → clear |
| 264 | Looks straight down the worm axis, as drawn; white needle tips, wheel-face and worm dots hidden. | clear → clear |
| 266 | Flat side elevation. The open rail frame, diagonal strut and white dots are replaced by a solid plank that starts flush with the fixed upright, with an upright under the fixed nut. The T handle is now a single crank arm with an outboard grip. | 0.020 foot/rails → clear |
| 261 | Front elevation. Floor slab removed; concave cast gusset under B's wall arm, as drawn. Disk, pulley and cord white marks and contact dots hidden. B's bearing arm now stops at the hub's rear face. | Arm/disk 0.040 and arm/hub 0.050 → fixed. Remaining (all pre-existing): crank pin seated in B 0.120 (coaxial); cord D crossing the crank pin 0.117 (the link C and cord planes are stacked); cord eye 0.030. |
| 268 | Flat elevation. Undrawn roller standard removed (the roller floats on its axle as drawn); white marks and contact dot hidden. | 0.050 (markers) and 0.010 roller/standard → clear |
| 262/263 | Base slab, roller guide posts, spring, slides and white marks removed. Roller C keeps a short axle. The nut post is now a flared standard E that reads as Brown's footed cradle in end view (262) and as the flared standard in side view (263). The spring or weight load is described but not drawn, so it is not rendered. | Spring/guide pairs 0.062, 0.034, 0.025 → only the cone/roller contact (0.0000) |
| 265 | The drum is now concave (horn-shaped), with a quadratic generator fitted to the plate's end radii and its radius under the roller. The roller axle stays tangent to the local generator and carries Brown's long shaft line. No-slip roller speed uses the exact integral of the quadratic radius. Four roller turns per traverse (was 5), because the mean radius changed. The profile vertices are inset by the chord sag. White marks hidden. | clear → clear |
| 270 | Brown's two figures are shown side by side: the working cutaway is on the right, and the assembled pulley is on the left, with a retainer cover showing six pin holes and a fluted journal end. The left figure shares the right figure's motion. White indices, belt beads and contact dots hidden. | 0.045 (marker) → 0.0006 race/roller rolling contact only |
| 250 | White indices and rolling-contact dots hidden. | 0.017 (markers) → clear |
| 271 | Flat side elevation. The ratchet is finer: 10.5 px pitch as engraved (was 14 px), 23 faces, short pawl 8 pitches behind the long one. The teeth are cut 10 px deep so the finite hooks clear the next ramp at pickup; Brown draws about 6 px. The thin bar lies on a plank table with two block legs and a post to the ground line; the bed rail, guide pedestals and keepers are removed. Added the left pulley and the cord from the bar end, hanging down the plate edge. The return lift rises over half the reset stroke, not 40%, so the finer teeth clear. Contact dots and white marks hidden; the rotating duplicate fulcrum pin is hidden. | Coaxial fulcrum 0.129 and marker 0.018 → cord seated on the pulley 0.0001 (see note below). |

The companion forks in this lane made the following changes; their captures are in
`/dev/shm/w2e/{A,B,C}`:

- **181/182:** hanging weights, slotted pivot heads and solid pin heads are removed in the factory, and the diagonal-catch bake was rebuilt with provenance. They are not removed by source presentation because that path crops the frame through a stale motion envelope. The rods end in open eyes.
- **190:** flat side elevation; white markers removed. The handle is raised above the holder so it no longer sweeps through the standard. Solid intersections 0.159 → 0.017.
- **175:** frame receives no stray shadows.
- **176:** unchanged; it already matches the plate.
- **219:** long fixed pinion spanning the eccentric range; drum with a four-arm cross. 0.0016 → clear.
- **221:** groove shown as a dashed path on a faint plate. 0.140 → clear.
- **224:** slotted wheel c in front, with studs in its curved slots. 0.074 → clear.
- **223:** marks removed.
- **220:** viewed from the plain-crank side; the pin projects through the slot.
- **246:** traced figures removed; C is a round knob.
- **247:** seabed reduced to a thin contact line.
- **248:** pipe lengths as drawn; plain nut.
- **251:** notched weight W fills the rails; undrawn anvil and pile hidden. 0.287 → rope seated in the head 0.07.
- **253:** springs, indices and stud supports removed.

## Residuals

- **260:** the thread on C is coarser than Brown's fine hatching.
- **264:** the wheels have no visible gap between their faces, and the needles are shorter than drawn.
- **261:** the crank pin and cord D occupy the same depth band when the pin sweeps past the cord (pre-existing). A clean fix would need a different plane stack for link C and the drum.
- **262:** the roller sits over the cone's smaller radius at 82% of its length, so in end view it only peeks over the large end, where Brown draws C fully above B. The eccentric carrier is a bar, not a round boss.
- **265:** the plate's shaft slope (−0.244) and roller-normal slope (−0.283) disagree with its radius under the roller. The fitted concave generator gives −0.20 there. The roller axle tilts as it traverses, and its bearings are undrawn.
- **270:** the left figure's cover-hole circle, 40 px, is taken from the plate and does not match the cutaway's roller-centre circle. Brown's two figures are not mutually consistent.
- **271:**
  - The bar still wraps back two pitches at the end of each 5 s display cycle, as before. The cord span wraps with it; the pulley is a plain disc, so its rotation is invisible.
  - The pulley's bearing is undrawn.
  - The teeth are deeper than engraved (10 px, not about 6).

## Validation

- **Reports regenerated:**
  - `docs/validation/260-266-275-thread-solids.json`: 33 poses, 0 penetrations.
  - `docs/validation/202-264-worm-solids.json`: sampled flanks clear. Its 202 source hash depends on the concurrent gears-core lane.
- **Tests:** the per-ID movement tests plus `cone-friction-solids`, `bearing-working-solids`, `ratchet-bar-finite-contact`, `differential-thread-solids`, `special-worm-solids`, `spatial-linkage-solids` and `tangent-rhombus-journal-solids`.
- **Camera coverage:** `camera-catalog` was run on scratch copies limited to one lane ID at a time.
