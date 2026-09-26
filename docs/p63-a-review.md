# Pass 63, lane p63-a: 105, 297, 298, 358, 391, 492

Captures: `/dev/shm/p63-a/before`, `/dev/shm/p63-a/after`, `/dev/shm/p63-a/final`
(default, ±60° and zoomed views at several phases), taken from a private
non-watching server.

## 105 screw press (`mujoco-screw-press/visual.js`; rebaked)

- **Before:** the default window ran from the handle to just under the raised
  ram, so the struck blank sat on the bottom edge.
- **Change:** the fit window now runs on down to the foot of the lower jaw
  (`profile.baseBottom`). Brown's handle-to-ram composition is kept above it.
  The whole C frame, the anvil and the blank are now wholly in view at every
  phase, and the ram is seen striking the blank. The ram is not cropped.
- Rebaked with `bake-mujoco-movement.mjs 105`: raw seam 0 px, round trip
  0.005 px. Only the presentation settings changed.
- The source-presentation note and the test that pinned the old window were
  updated.
- **Intersections:** unchanged. Only the camera window changed.

## 297 lantern escapement (`lantern-finite-playback-parts.js`, `authored-lantern-escapements.js`)

- **Cause:** both arbors (r 0.16) sat in 0.166 bores in their hubs. The hubs
  turn with the arbors, so that ring was not a bearing clearance. Through the
  0.006 gap the background showed, as light speckled arcs round the hub faces.
  Hiding the arbors confirmed this: the light arcs became open holes.
- **Change:**
  - Each arbor is fixed in its own hub (r 0.168, filling the bore).
  - The arm hub's bore is 0.15, so it no longer coincides with the arm's bore.
  - Same-body pairs were dropped from the working-clearance pairs.
- **Result:** the hub faces are clean at 1× and 3× DPR. The arm/hub z-fight
  finding is gone: zfight 1 → 0.
- **Intersections:** none, before and after.

## 298 geared verge (`authored-geared-balance-verge.js`)

- **Before:** display time 0 was the arbor's 34° extreme, so both loops leaned
  with the arbor.
- **Change:**
  - Display time now starts a quarter period in (`displayTimeOffset`), at
    mid-swing. The arbor angle and the balance angle are both zero there.
  - The balance spokes are laid out so that at that pose one points left and
    two reach right, as Brown draws them toward C.
- The loop geometry and its seams are unchanged.
- **Forced residual:** Brown's two loops lean the same way. The model's loops
  are opposite-handed helices, mirror images through a plane across the
  arbor, so they always lean in mirror-image directions. Mid-swing is the most
  upright, symmetric pose.
- **Loop seam:** clean (score 0).
- **Intersections:** none.

## 358 fusee carriage (`authored-fusee-traverses.js`, `cord-traverse-working-parts.js` 358 branch)

- **Rails:** Brown's two horizontal double lines are the carriage's long flat
  side bars. They run from under the far wheel frame, past the fusee and the
  crank, and off the plate at his break.
  - They are not guide rails. The traverse runs across them, in the direction
    the edge-on wheels roll.
  - The short gray frame bars are replaced by two long flat bars (0.24 wide),
    which lie under the wheel-frame bars and end cleanly past the crop (y 7.5, off the app's wider stage too). One
    cross bar carries the crank-end bearing.
  - The bars must clear the crank's sweep (radius 1.3). They therefore sit at
    ±1.44. The wheel axles moved out from 1.75 to Brown's 2.0 so the wheels
    clear the bars.
  - Direct check over 201 poses: the minimum clearance of the crank, fusee and
    wheels to the bars is 0.022.
  - The camera still frames the carriage without the bars.
- **Forced residual (band):** the band stays 0.032 (about 2/3 of Brown's
  ≈0.05).
  - Both cords must act at the same groove station, so that winding on and
    off match. They therefore lie side by side in one groove turn of pitch
    0.152, which caps the radius at about 0.036.
  - Two alternatives were tried:
    - Departing the cords half a turn apart hides Brown's front crossing
      line.
    - Departing them a whole turn apart breaks the equal-radius kinematics.
  - Brown's bottom bar also crosses under the fusee's large end in plan.
    Placing it there would need it below the wheels' rolling plane, so both
    bars stay symmetric.
- **Intersections:** the voxel screen still runs out of heap (28-unit track).
  The direct check above covers the new bars.

## 391 alternating racks (`weighted-rack-selector-contact.js`, `authored-alternating-weighted-racks.js`)

- **C's shape (Brown's):**
  - A slim curved arm (circular arc R 2, half-width 0.04 tapering to 0.03,
    rounded tip).
  - The short left arm, which rests on a small fixed stop pin under its end.
    This is Brown's knob.
  - A small bored pivot boss.
  - The broad web at the foot is gone.
- **Link:** now a separate bar hung on a pin in C, drawn in front of C as
  Brown draws it.
  - It is an ideal two-force strut. When rack A1's top lug roller meets its
    rounded lower end, the link lines up between its pin and the roller. The
    rising rack then swings C back against spring d.
  - At the upper corner the loaded spring drives the link down onto the rack
    top and pushes the pin outward over the angle.
  - C then comes back to its stop, and the free link falls back to hang from
    its pin. The fall is prescribed as a cubic from its release angle and rate.
- **Swing:** now 33° (was 15°). A rigid link/arm face was searched first; it
  could not exceed about 23° with continuous contact and a release before the
  crossover ends.
- **Kinematics:**
  - The hanging link is met end-on: the roller rises straight under its pin.
  - The link carries the pin past the crossover midpoint and lets go at
    t ≈ 3.83 (the crossover ends at 4.0).
  - The rack torque stays outward throughout assist (−2.77 to −4.35 per unit
    thrust).
- **Supports:** the undrawn gray bracket and its web down to guide b are
  removed. The pivot, stop and spring anchor are short bare pins.
- The lug roller sits at the link's plane, just below the pin arm.
- **Tests:** the tests that pinned the old face design were rewritten for the
  strut:
  - end-on mesh contact, with the normal along the link
  - outward torque
  - compressive reaction with positive spring tension
  - the stop pin touching the short arm
  - continuity of C and the link through entry, release and the fall
- **Intersections:** only the intended spring hooks remain (0.0166, 0.0158),
  as before. Faces: clean.
- **Framing:** at full swing the short arm reaches the top of the view
  (maxNdc 0.9995). The display profile needs re-measuring.

## 492 boat detacher (`authored-boat-detachers.js`)

- **Before:** a quadratic curve ran from the lower eye to a horizontal lead.
- **Change:** the release rope now runs taut and straight from the lower eye's
  loop to the top of the lead sheave. The sheave sits beyond the crop on
  Brown's line, falling gently to the right.
  - The pull bar rides on that line.
  - The hanging tail still takes up the length drawn in.
  - The rope is straight at every phase and in rotated views.
- **Intersections:** the eye-loop rope against the lever's lower arm is
  0.0022 (deforming; the loop wraps the eye bar; it was 0.0015 before). Otherwise only the existing
  contacts.

## Tests run

- `mujoco-screw-press`: pass.
- `movement-297`, `lantern-working-solids`, `lantern-pallet-contact`: 15/15
  pass. `generate-lantern-escapement-motion.mjs --check` passes.
- `movement-298`, `movement-358`, `cord-traverse-working-solids`,
  `camera-resize`, `boat-detacher-contact`: pass. `movement-492` passes after
  its bar-attachment test was rewritten for the straight rope (it now also
  checks straightness). `source-presentation`, `mujoco-baked-loops` (116):
  pass.
- `weighted-rack-selector-contact`, `movement-391`,
  `weighted-rack-handoff-solids`, `alternating-drive-solids`,
  `movement-392`: pass.
- `check-loop-seams` (297, 298, 358, 391, 492): 0 above tolerance.
