# Lane m14: last minor residuals (184, 269, 271, 208, 261)

Pass-51 minor-residuals lane. Lanes m8 and m12 had judged most of these residuals forced. This lane
tried a new construction for each one. Captures came from a private non-watching Vite server (port
44338) using `review-movement-source-views.mjs`, plus phase stills and engraving overlays. They are
kept in `/dev/shm/m14` and are not in Git. Intersections were screened with
`show-body-intersections.mjs ID --spacing=0.01 --samples=129` (257 samples for 271).

## Changed

### 184: rods hang down from Brown's mid-height pins (`authored-quadrant-catches.js`, 184 branch only)

- **Overlay:** the plate was scaled onto the render at the two shafts. The wing's outer arc, its
  pointed window and its tip all lie within a few pixels of Brown's. The ledger's claim that the
  wing is turned about 60° from Brown's is stale. The difference was the back-weight gear:
  - Brown hangs the ball-lever handle's rod from a pin down-right of its (upper) hub, clear of the
    wing.
  - Brown hangs the wing handle's rod from a pin up-left of its (lower) hub, behind the piston rod
    (dashed on the plate).
  - Both of Brown's rods hang down. The wing tip carries no eye.
- **Change, 184 only:**
  - Each handle gets a slender arm in the rear layer W, ending in an eye at Brown's measured pin
    position (plate-184 px relative to each hub).
  - The rods hang down from those eyes and are cut at the piston rod's lower break.
  - The wing is trimmed to its concentric rim and squared off, so 183's eye tab is gone.
  - The piston rod runs between Brown's breaks (30 to 490 px), not 183's.
- **Why the physics is unchanged:** in the unreflected frame, each new arm is 183's arm turned about
  half a turn, with the pull reversed. An upward pull at r equals a downward pull at −r, so each
  weight turns its handle the same way. Its lever arm keeps its sign over the whole solved swing
  (ball pin −48°→+7°, wing pin 140°→180°).
- **Solve:** the W layer holds nothing else of the other handle, so the baked solve is untouched.
  The 183 view does not change.
- **Intersections:** 0.0005 → 0.0005. Only the seated stud/lip remains, plus the tangent
  boss/stud (0.0001) and the rod/eye-pin coaxial joints. `docs/validation/183-current-solids.json`
  was regenerated: 183 and 184 are both 0.00055.
- **Tests:** movement-184 has a new test, "rods hang down from Brown's pins". movement-183,
  movement-184 and quadrant-catch-finite-interfaces pass (10/10).

### 269: every tooth reads full from the front (`authored-mutilated-racks.js`)

- **New attempt, rejected:** keep full teeth and add a gap between rack groups. With a sharp
  (w = 0.05 pitch) or wide reversal, the swept full-height teeth still lose area to the pinion:

  | Group gap | Area lost by the handoff teeth |
  |---|---|
  | 0 | 65–69% |
  | 1 pitch | 42–65% |
  | 3 pitches | 65% |

  The reason: after the pinion reverses, its teeth on the old rack move at twice the frame speed
  relative to that rack. They overtake its last tooth unless that tooth is more than about 1.6
  pitches from the reversal. That needs about a 3.3-pitch gap per handoff, about 10 extra pitches
  of stroke, which is not viable. The relief itself is forced.
- **Adopted: relief in depth.**
  - Each relieved rack tooth keeps its relieved working outline at the front.
  - Behind the pinion's rear face, it also carries Brown's full straight-flanked outline as a thin
    web (z −0.242…−0.292). A backing strip joins the web to the rail.
  - From the front, all 17 teeth now read as full teeth, as on the plate.
  - At the handoffs, the pinion teeth pass in front of these webs and never reach their depth.
  - The handoff teeth are no longer drawn in a darker colour.
- **Framing:** unchanged.
  - The fit already equals the frame's swept silhouette. The frame travels 17 pitches against its
    own 22-pitch length, so the subject cannot be larger.
  - Only the rod leaves the view at the stroke limit. Brown breaks the rod off himself.
- **Intersections:** clear → clear. Two bodies, no pairs. The existing tooth-clearance test gives a
  minimum of 0.0048.
- **Tests:** movement-269 has a new test for the webs (behind the pinion, full tip height) and passes
  10/10.

### 271: Brown's shallow teeth (`authored-ratchet-bars.js`)

- **Teeth:** the rack teeth are now about 6 px deep, as engraved, where they were 10 px. The tips stay
  at the hook line (284 px) and the roots are at 290 px (0.108, was 0.18).
- **Hooks:** a slimmer hook nose (radius 0.022, was 0.035) working 0.04 below the crests (was 0.045)
  clears the next ramp at pickup. The 0.05 pickup, the stroke, the lever amplitude and the timeline
  are unchanged.
- **Checks:**
  - The hook and shoulder clear every tooth on both strokes (area check, 513 poses).
  - The active hook seats on the face with a gap under 1.2e-5.
  - Phase stills show the hooks seated and lifted as before.
- **Intersections:** unchanged. Only the cord seated on the pulley (0.0001) and the cord/bar-end
  joint remain. The open flag on the sawtooth mesh was already there before this change.
- **Tests:** movement-271 (raster root pinned at 290), ratchet-bar-finite-contact and
  alternating-drive-solids pass.

### 208: a wide slotted strip, as drawn (`variable-drive-205-209-parts.js` 208 branch, `generated-pin-slot-208.js`, `scripts/export-208-pin-envelope.mjs`)

- **The finding:** a width limit applies only on the pinion's outer side. There, the next outer ring's
  pins sweep past the pinion off its centre line (m12's argument). On the inner side, the next inner
  ring's pins never come within 0.23 of the pinion's plane at any selector position.
- **Width:** the slotted pinion now runs from its working face (−0.055) inward to +0.205. It is
  0.26 wide (was 0.11), against Brown's 0.34.
- **Slots:** they are the pin envelope regenerated over the whole slab. The export script now clips
  the pin sweeps to `pinion208Slab`, and 61.5% of the blank is kept. The slots are open-ended, so the
  inward drift of the engaged pins stays inside them.
- **Collar:** the selector collar moved to the new inner face.
- **Result:** from the front, the pinion reads as Brown's strip with dark slot bands across it. It no
  longer looks like a thin notched web. Brown's slots are closed at the ends; closed ends remain
  impossible for the reason m12 gave.
- **Intersections:** the pre-existing neighbouring-ring pin/web limit went from 0.0535 to 0.0523.
  It occurs when the inner ring is engaged and the middle ring's pins cross the working face, and
  it is independent of the widening. Nothing new was added.
- **Validation:**
  - `review-208-pin-slots.mjs`: 167 poses, zero sampled penetration, maxWorkingGap 0.00166.
  - `docs/validation/205-208-209-contact.json` was regenerated through the documented pipeline;
    the generated outline is reproduced byte for byte.
- **Tests:** movement-205, movement-208 (with a new width and inner-ring test), movement-209 and
  variable-drive-205-209-solids pass (19 + 1).

## Forced, with precise reasons

- **261:** these constructions were tried, beyond m8 and m12:
  - A drum on B's near face with the strand in front of B. The cord plane is set by E's groove,
    which lies behind A, because A is drawn over E. C hangs from A and passes in front of the
    strand, as drawn. So the crank pin must join B, behind the cord plane, to C, in front of it,
    and its shank crosses the cord plane at radius 0.65 (Brown: 0.76 R_B). On the drum's left, the
    strand crosses every radius from the drum (0.22; Brown: 0.45 R_B) out past B's rim. So once per
    turn the pin cuts the strand.
  - C behind the cord plane. C would then pass between the drum and B, and it crosses the
    drum/shaft junction when the pin is near the bottom.
  - The pin on B's far face. Rod C would then pass behind B, where Brown draws it in front.
  - A crank arm on the drum's front face, in front of the cord. This works mechanically, but it
    adds an undrawn spoke that sweeps over B. That is a larger visible departure than the strand
    ending at the rim.

  The residual stays.

## Proposed ledger text

- **184:**
  - (a) Default capture and plate overlay inspected. The reflected 183 gear lies on Brown's
    outlines. Both back-weight rods hang down from Brown's mid-height pins, the right pin down-right
    of the ball handle's hub and the left one behind the piston rod. The wing tip carries no eye.
  - (b) sampled-clear: only the seated stud/lip (0.0005).
  - (c) visibleFlaws: none. limits: "Plate 184 is plate 183 reflected top to bottom; the view is a
    presentation reflection of the 183 solve at 183's pose, with the weight arms turned half a turn
    to Brown's pins (same weight torque); weights are represented by the solve's weighted
    direction, not forces."
- **269:**
  - (a) Default and handoff-phase captures inspected. All 17 rack teeth read full, as drawn; at the
    handoffs the pinion passes in front of the recessed webs of the relieved teeth.
  - (b) sampled-clear.
  - (c) visibleFlaws: "The closed end sits farther right than drawn and the subject is smaller than
    on the plate (the frame's 17-pitch stroke against its 22-pitch length sets the swept silhouette)."
    limits: "The handoff teeth are relieved at the working depth and keep their full outline only
    in a web behind the pinion (Brown's spacing would jam); the rod, which Brown breaks off, leaves
    the view at the stroke limit."
- **271:**
  - (a) Default and phase captures inspected. The shallow teeth are about 6 px deep, as engraved,
    and the hooks seat and lift as before.
  - (b) sampled-clear: only the cord on the pulley (0.0001).
  - (c) visibleFlaws: none. limits: "The in-view bar return after two vibrations (both pawls
    lifted, bar slides back over 2.5 s) is a prescribed demonstration reset; Brown draws no pulley
    bearing."
- **208:**
  - (a) Default capture inspected. The pinion is a wide slotted strip with dark slot bands, like
    Brown's lantern strip, and 0.26 wide against his 0.34.
  - (b) known: the neighbouring-ring pin/web limit (0.0523) remains.
  - (c) visibleFlaws: "Brown's slots are closed at both ends, but ours run open across the strip."
    limits: "A 0.052 pin/pinion overlap when the inner ring is engaged is geometric (the middle
    ring's pins must pass the working face); the widening is inward only."
- **261:** unchanged. The reason is given above.

## Notes for the integrator

- Re-measure the display profiles of 184 (the rods and piston rod changed extent) and 208 (the
  pinion is wider). 269 and 271 changed only negligibly (webs behind the rail, a 4 px tooth depth).
- `docs/variable-drive-205-209-review.md` still describes the 208 slab as ±0.055. It is now
  −0.055…+0.205 (`pinion208Slab`).
