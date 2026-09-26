# Pass 61 follow-up (lane p61-followup)

Fresh captures from a restarted non-watching server (port 44537), scratch in
`/dev/shm/h7` (`before/`, `a1/`–`a8/`, `fin/`–`fin4/`; not committed).
Intersections: `scripts/show-body-intersections.mjs`, 0.01 spacing.
Face scan: `scripts/scan-bad-faces.mjs` (`/dev/shm/h7/scan-before.json`,
`scan-after2.json`).

## 302: factory throw

- **Cause:** `makeCrownEscapeWheel` no longer exposed its white witness as
  `userData.indicator`, removed alongside the spokes lane's Debaufre-wheel
  edit. 302 reads it to hide it, and 234's renderer test reads it too.
- **Fix** (`authored-escapements.js`): the crown wheel exposes the witness
  again. The witness mesh itself had never been removed. 302 now hides every
  `crown-wheel-rotation-witness` by role, so the fix does not depend on that
  handle.
- **Verified:** `fin/302-*`. The crown wheel D, the verge with A and B, and
  the balls render as before.
- **Intersections (129 poses):** only seated 0.0000 tooth/pallet tips.
- **Tests:** `movement-302`, `movement-234`, `verge-crown-working-solids`
  (all 5, including the 302 case) and `authored-loader` pass.

## 314: rebuilt as flat parts in Brown's planes

The plate was re-read with classical contour fitting:

- **Teeth.** Brown draws **13 teeth**, not 15. A circle fitted to the eight
  free tips gives centre (176, 275) and a 176 px radius. The tips are 27.7°
  apart, and the six-interval gap across the lever side is 169°.
- **Lever pivot.** The lever pivots on the **large circle on the crescent**
  (371.5, 375.5), directly below the balance staff, like 296's pallet arbor.
  The model had used the dashed circle under the lever top.
- **Fork and C.** The fork at the lever top holds the roller pin
  (372, 159.4). C is a straight blade from inside the disc (320, 130) to
  (282.5, 146).
- **Disc.** A circle fit gives the disc a 90 px radius. Its small notch is
  at the upper left.

Rebuild (`authored-lever-chronometers.js` rewritten;
`detached-chronometer-working-parts.js` deleted, since only 314 imported it
and its 308 branch was already dead):

- **Planes.** Everything is a single flat extrusion:
  - front plane (z 0…0.24): the wheel, the crescent carrying A and B, and C;
  - lever plane (z −0.24…0): the lever;
  - disc plane (z −0.40…−0.24): the balance disc.

  This follows Brown's overlaps: the crescent over the lever (the lever
  dashed under it), and the lever and C over the disc.
- **Wheel.** One plate from the shared spoked-wheel builder. It keeps the
  spokes lane's web and adds the 13-tooth outline: a hooked front with the
  back running the whole pitch. The cross stands square in the plate pose.
- **Lock faces.** A and B are arcs about the lever arbor. Each is the path of
  the resting tooth tip, so the wheel neither advances nor recoils while
  locked. Each stone lies on the tooth's push side, and its release edge
  follows the tooth's travel.
- **Crescent.** The inner edge is one circular arc just outside the envelope
  of the tooth tips over the lever's throw. The outer edge is a circular arc
  through Brown's outline, with square ends. A final swept-teeth cut adds
  0.0015 of running clearance.
- **Lever.** Concave circular sides: 26 px half-width at the fork, 19 px at
  the waist, 28 px at the foot. The fork is the roller pin's swept path. The
  horns stop at y 155; Brown's y 145 would be cut into curls by the pin as it
  leaves.
- **Banking.** The pins sit tangent to the foot at ±7.04°. They stand within
  5 px of Brown's positions.
- **C.** One plate: a collet on the staff, and Brown's straight blade
  continued inward into it.
- **Kinematics** (redesigned so the drawn shapes engage):
  - The fork's geometry at ±40° of balance sets the lever throw to 7.04°.
  - A releases just after the blade passes clear of the locked tooth's tip.
  - The wheel then drops onto C, catching it from behind with matched
    position, speed and acceleration.
  - The wheel follows exact contact with the straight blade: the tip stays on
    the face, and the normal speed error is below 1e-6.
  - The tooth slides off C's end and runs on a smooth quintic to land on B at
    0.75 pitch.
  - On the return, B releases for the 0.25-pitch transfer.
  - Time 0 is the plate's pose: balance centred, lever mid-throw, A locked.
- **Removed.** The grey front cock and the front journal are gone. The arbors
  run back to bored bosses on plain bars behind the balance disc. There are
  no hidden posts, nibs, marker spheres or face-edge tubes.
- **Build time.** 355 ms in Node, 215 ms load in the browser.

Verification:

- **Default view** (`fin4/314-default.png`): it reads like the plate.
- **Rotated, top and back** (`fin3/314-rotL/top`, `a4/314-back`): every
  part is flat. The back bars are behind.
- **Motion strip** (`fin3/314-t*`, `fin2/314-z*`): C is driven by the tooth
  tip, A and B lock, and the fork carries the pin.

Intersections (129 poses):

- wheel/crescent 0.0010: the seated lock contact, within the running
  clearance;
- wheel/C 0.0000;
- a left banking pin/crescent coaxial 0.0000 (touching planes);
- all arbors bored.

Tests: `movement-314` (rewritten for the new design) and
`detached-chronometer-working` (rewritten: finite-solid clearance through the
cycle, banking contact, plane layout) pass.

Data edits:

- `movements.json`: the archetype is `thirteen-tooth-…`;
- `source-presentation.js`: the 314 `remove` list is empty now that none of
  its targets exist, and the note is updated;
- `rotation-indicators.js`: 314 keeps only the disc's cue.

Residuals:

- **C length.** C reaches 1.50 from the staff; Brown draws it to 1.74. Any
  longer and it could not pass back between the locked teeth: the lens
  where it crosses the tooth circle would exceed the 0.75-pitch window. It
  ends just inside the disc's edge rather than just outside.
- **Crescent width.** The crescent is thicker at its inner edge than Brown's,
  because it clears the tips over the whole lever throw.
- **Omitted.** The dashed circle under the lever top, probably a guard pin,
  and the two screw dots on the crescent are not modelled.
- **Speed overshoot.** The wheel's drop speed briefly overshoots C's speed
  (by 1.6×) before the matched catch.
- **Prescribed motion.** Motion is prescribed kinematics, not dynamics.
- **Framing.** The display profile (stale 15-tooth motion bounds) still
  frames the default view, which crops the lever foot. **314 needs
  re-measuring.**

## 300/301: the shared builder

- **Plate.** Brown's 300 draws **plain spokes** with sharp corners at the
  rim and at the boss arc: the lower window is two straight spoke edges
  between the boss arc and the rim's inside. There are no fillets. The spokes
  are 90° apart, the down-left one about 37° off the vertical, and the upper
  pair is cut off by the break across the boss.
- **Builder** (`spoked-wheel.js`): a zero `hubFillet` or `rimFillet` now
  gives a plain sharp corner (the corner point once). Filleted wheels are
  unchanged, and `spoked-wheel.test` passes.
- **Wheels** (`authored-escapements.js`, `makeDebaufreRatchetWheel`): each
  wheel is **one extrusion** from the builder, containing:
  - the rim and the twelve barbed teeth (the outline is the union of the rim
    circle and the exact tooth profiles);
  - four 0.28 plain spokes meeting the rim's inside (1.78);
  - a 0.6 boss arc;
  - a bore for the brass collet.

  The exact tooth prisms stay as hidden analytic references. 300 and 301
  still share one model. This replaces the interim round boss and the four
  separate box spokes.
- **Verified:** `a1/300-*`, `a1/301-*`, `fin3/300*`, `fin3/301*`. The spokes
  meet the rim with the plate's slant. 301's edge-on strips are unchanged.
- **Intersections:** 300 clear (129 poses); 301 clear (65 poses).
- **Tests:** `movement-300`, `movement-301` and
  `debaufre-300-301-working-solids` pass. The spoke assertions were rewritten
  for the one plate, and the negative control now uses the plate.

## Face-scan fixes

Scan after the fixes (`scan-after2.json`): the listed IDs have **no inward,
shading or mixed findings**. Remaining zfight entries are pre-existing flush
collars, outside this scope.

| ID | Cause | Fix |
| --- | --- | --- |
| 269 | rod-end box built with a negative length | `Math.abs` length (`authored-mutilated-racks.js`); made 0.006 thinner than the bridge it enters, so the faces inside the bridge do not z-fight |
| 280 | lathe profile listed downward (inward normals) | profile reversed (`authored-friction-windlasses.js`) |
| 286 | web boxes with a negative depth | positive depth, same span (`authored-poppet-valves.js`) |
| 321 | spring wire wound clockwise against outward normals | winding flipped (`authored-going-barrels.js`) |
| 298 | wire loops folded where the centreline bent tighter than the wire radius (release corner, top wrap, seam) | smoothed within a cos²-tapered window round each corner until every bend is at least 1.3 wire radii (`authored-geared-balance-verge.js`); the working helix moves only within the window at the release corner |
| 287 | both leaf-strip end caps wound inward | caps re-wound (`authored-pickering-governors.js`) |
| 400 | return-spring curve jumped from the axis to the coil radius (frames twisted) | plain helix end to end, ending one wire radius short of the leg and stop; coil radius 0.13 → 0.11 so the coils stay on the stop's face and clear of its strap (`authored-four-motion-feeds.js`) |

- **Visual check** (`fin/`): 269's dark rod neck now renders solid between
  the frame end and the collar. 280's grip, 286, 287's leaves, 298's loops,
  321's wire and 400 read normally.
- **Intersections (65 poses):**
  - 269 and 298 are clear;
  - 400 was clean after the coil change. It had shown 0.032 against the stop
    and 0.0125 against the strap with the 0.13 coils at first. The spring
    tube stays open-ended, as before.
- **Tests:** `movement-269/280/286/287/298/321/400`, `four-motion-feed-solids`,
  `cam-281-286-solids`, `mutilated-bevel`, `windlass-hardware`,
  `windlass-flange-clearance` and `p61-faces` pass.

## 108: baked groove lands

- **Cost.** 108's visible double-start groove lands (`reverseThreadLands`)
  took about 3.7 s of its 4.8 s geometry build.
- **Bake.** `scripts/bake-reverse-thread-lands.mjs` bakes the exact
  triangles, positions and normals (float32, indexed; 6440 triangles, 86 KB
  gzipped) into
  `src/simulation/baked/assets/reverse-thread-108-lands.json.gz`, with the
  SHA-256 of the source files and a mesh fingerprint.
- **Loader.** `src/simulation/baked/reverse-thread-lands.js` loads the asset.
  It uses fetch in the browser and a direct file read in Node.
- **Route.** The baked route in `mujoco-baked-routes.js` passes the baked
  lands to `makeReverseThreadGeometry({bakedLands})`.
- **Live path unchanged.** Without the option, `geometry.js` still builds
  the lands, and their collision cells, from the profile. `?live` physics is
  unchanged. No motion source changed, so the loop needs no rebake.
- **Load time:** 5.5 s → 0.43–0.5 s in the browser (`a8`, `fin3`); 0.56 s in
  Node. The rest is the profile's tilt table (about 0.28 s) and the gear.
- **Tests:**
  - new `tests/reverse-thread-lands-bake.test.mjs`: source hashes match, the
    baked mesh fingerprint equals the live construction, and the route uses
    the baked lands while the live geometry keeps its collision cells;
  - `mujoco-baked-loops` (108), `mujoco-reverse-thread-candidate` and
    `authored-loader` pass.

## Display profiles to re-measure

314 (geometry, tooth count, bounds), 300/301 (one-plate wheel), 400 (spring).
