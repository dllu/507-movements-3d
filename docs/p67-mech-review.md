# Pass 67, lane p67-mech: 346, 351, 361, 367, 368, 370

Reviewer: Claude Opus 5.5 (lane p67-mech), 2026-09-26. Each ID was checked against `public/engravings/mm_NNN.png`
and the user's pass-67 feedback. Captures are outside Git in `/dev/shm/p67-mech/`:

- `before/` and `after/` hold `ID-{default,oblique}.png` from `review-movement-source-views`.
- `T<ID>-a.png` tiles the default view at phases 0, .25, .5 and .75, then ±60° yaw, top and back views.
- The close-ups are `c346a.png`, `c361a.png`, `c367a.png`, `c368a.png`, `Y370.png`, `Z370.png` and `W370.png`.

Intersections were screened with `show-body-intersections --spacing=0.01 --samples=129`, one ID at a time.

## 346 table engine (`authored-table-engines.js`)

**User:** the bottoms of the grey guides are disconnected.

- The two slot rails used to stop 0.4 source units above the guide foot. Their rounded top was a thin tube that did not
  meet them. Brown carries both slot lines down to the stepped foot on the cylinder cover.
- The rails now stand on the foot's top face (y 7.97).
- The rounded end is now a half-annulus bar with the rails' own width and depth. Its inner and outer radii (0.535 and
  0.785) are flush with both rail tops, so the guide reads as one U standing on the foot (`c346a.png`, `T346-a.png`).

**Intersections:** clear before, clear after. Only the pre-existing open tube arch of the outer strap is noted.

## 351 gravity stamp (`authored-stamps.js`)

**User:** the rack carries unused teeth; Brown matches 8 rack teeth to the pinion's 8.

The rack is now cut only with teeth −7…0 (`firstRackToothIndex = −(sectorToothCount − 1)`, `lastRackToothIndex = 0`).
The removed teeth were −9, −8 and 1…4, of which −8 and 1–3 were visible.

A contact sweep over 200 samples (`/dev/shm/p67-mech/t351b.mjs`) shows the pairing:

- Pinion tooth k drives rack tooth −k on its lower flank for k = 0…7.
- Tooth 0 is also the pickup tooth.
- Every rack tooth is used, and no rack tooth is left without its pinion tooth.

The carried release and pickup still pass. The worst per-sample jump and the finite clearance tests are unchanged.

**Residual.** A smooth length of rod, about three pitches, remains between the top tooth and the top collar.

- Brown draws the teeth running up to the collar.
- But his collar overhangs the pinion side. At the lowered rest it would then sit at the pinion's centre height, inside
  the pinion, so the plate is not self-consistent.
- The model keeps the collar just clear of the pinion's tip circle at rest.

**Intersections:** clear before, clear after.

## 361 axial pin clutch (`authored-axial-pin-clutches.js`, played helper `one-way-clutch-working-parts.js` `correctAxialPinParts`)

**User:** the pulleys need flanges as Brown draws (like 255), so the belt stays on when the pulley slides axially.

- The flanges had the rope's pitch radius (0.46), so the rope stood 0.038 proud of them.
- Both pulleys now carry two belt-retaining flanges of radius 0.54, measured from Brown's flange height against the
  shaft spacing. The rope (radius 0.038 on the 0.46 pitch circle) runs between them in the grooved sheave, as 255's
  flanged pulley retains its belt.
- The unused dark groove torus is no longer built. `correctAxialPinParts` now tolerates the null groove.

See `c361a.png`: both pulleys show edge-on as two tall flanges with the rope between them, as in the plate.

**Intersections:** clear before, clear after. The belt-in-groove solid test still passes.

## 367 graduated-arc parallel ruler (`authored-parallel-rulers.js`)

**User:** the ivory scale does not reach the brass arc in the open position, and the arc's lower pin isn't centred.

**Scale.**

- Near full opening the arc runs almost tangent to the scale edge. Its band then lies on the strip from local x −1.07
  to −0.35, but the strip began at −0.50.
- The factory now sweeps the arc band and its rounded tip over the whole link travel (33 angles by 721 arc samples).
- The strip's left end is set 0.06 past the leftmost overlap (−1.13). The right end and the calibration are unchanged.

**Pin.** The fastening pin and its bore moved 0.03 inward to the centre of the arc's rounded lower end. That end is
centred on the band's centre line, 0.03 inside the calibrated outer edge. See `c367a.png` and `T367-a.png`.

**Intersections:** unchanged. The pre-existing 0.0798 overlap of the right link's upper-blade through-pin with the brass
arc remains near t = 3.19, where the arc passes under the link boss. The arc lies between the blade and the link
levels, so the pin must cross its path.

## 368 cylinder spiral scriber (`authored-cylinder-spiral-scribers.js`)

**User:** the rack and pinion teeth are hidden at the default camera. Either flip them, or make the rack semitransparent.

**Why the rack is not flipped.**

- Brown draws the rack behind the pinion, its teeth toward the viewer, with the upright bevel meshing on the right of
  the horizontal wheel.
- With the bevels as drawn, a rack behind the pinion turns the cylinder so that the traced helix falls to the right on
  the cylinder's front face. Brown's line rises to the right into the marking point.
- So the plate cannot have both. The existing mirrored model keeps his helix, with the rack physically on the pinion's
  near side.

**What changed.**

- The rack's backbone and teeth now use the shared see-through style (`see-through-part.js`). The spur pinion's teeth
  and the rack teeth both read through the rack at the default view, as horizontal tooth lines like Brown's
  (`after/368-default.png`, `c368a.png`).
- Every eighth rack tooth was dark, a marker stripe that became visible through the rack. All teeth are now uniform.
- `docs/validation/368-372-contact-solids.json` was regenerated with `POSES=33`: 0 penetrations, gaps unchanged.
- The source-presentation note is updated.

**Intersections:** clear before, clear after.

## 370 mirror polisher (`authored-mirror-polishers.js`, played helper `polishing-joint-parts.js` `correctMirrorPolisher`)

**User:** the ratchet clips through the black pins, and the pawl is on the opposite side from the plate.

**Click side and direction.** Brown's hooked click reaches down over the ratchet's upper-left teeth and draws them
upward. The wheel turns clockwise in the plate, and its tooth tips point counterclockwise: down on the left side, up
on the right.

The model now has `clickHand = −1`:

- the carrier's base angle is 142° (was 38°);
- the carrier swings clockwise and the ratchet advances clockwise;
- the ratchet outline is generated with hand −1;
- the click's trailing direction is mirrored.

The finite click solve still keeps a 0.002 to 0.01 gap to the working teeth, with no area overlap.

**Pins.** The guide pins now run only from inside the lower rail to just past the bar's front face (z −0.10 to 0.20).
The mirror and ratchet in front of the bar (from z 0.21) pass over them.

**Other flaws, found against the plate and the screen.**

1. **Crankshaft through the bar.** The crankshaft ran from behind the bar through the plane the bar sweeps. This was
   the known 0.119 overlap, plus the bearing at 0.078 and the handle against the bar at 0.06. The crank side is now
   rebuilt in front of the bar, in Brown's order: handle crank in front (z 1.00–1.14), upper rail, eccentric, then the
   eye crank. The shaft (z 0.22–1.12) never reaches the bar. The upper rail is now in front of the bar and the lower
   rail behind it, as Brown draws both.
2. **Follower rod over the shaft.** The telescoping follower started at the eccentric centre and crossed the shaft. It
   now leaves the rim of an eccentric strap ring round the disk.
3. **Proportions.** Brown's ratchet spans about 0.83 of the mirror's side. The ratchet is now radius 0.52 (was 0.72),
   and the square mirror is 1.20 on a side (was 1.06). The ratchet lies over the mirror, as Brown draws its teeth over
   the square. The bar now runs a square end 0.30 past its top eye, as drawn.

**Intersections.**

- Before, 17 pairs: crankshaft × bar 0.119, guide pin × ratchet 0.089, handle × follower 0.087, bearing × bar 0.078,
  handle × bar 0.06, and others.
- After, only joints inside the follower assembly remain:
  - telescoping inner rod × lower ball joint, 0.061 (pre-existing);
  - rod × its own strap ring, 0.012;
  - click journal pin × follower ball joint, 0.011 (coaxial).

**Residual.** Brown draws the mirror and ratchet behind the bar. Here they are in front, because the lower-rail guide
pins must reach the bar and the mirror passes over the guide at the bottom of every stroke.

## Checks

- Loop seams (`check-loop-seams --ids=346,351,361,367,368,370`): 0 seams above tolerance, 0 pops.
- `scan-bad-faces`:
  - No inward or shading faces.
  - The 370 shaft-end z-fight with the handle arm is fixed.
  - Remaining z-fights are pre-existing: the 346 plinth and bearings, the 351 head face, and the 361 flange and hub.
