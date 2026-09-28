# Pass 98, lane p98-g: 247 re-arming loop and 251 leaf springs

Reviewer: Claude Opus 5.5, lane p98-g. Date: 2026-09-28. No git writes.

Both findings came directly from the user. Captures are in `/dev/shm/p98/g/` (outside Git). The vite server ran on port 45997.

## Claimed files

- `src/simulation/authored-sounding-weights.js` (247)
- `src/simulation/release-mechanism-working-parts.js`: shared with 278, but only 247's functions changed. 278's geometry and pose hash is unchanged at `7036e8a3af6b5f06`, checked with `/dev/shm/p96/fc/g4/hash.mjs`.
- `src/simulation/authored-pile-drivers.js` (251)

No saved validation report or bake fingerprints these files, so none was regenerated.

## 247: sounding-weight release

**User finding.** Don't drop a new weight from above. Lift the existing weight slightly off the ground, then have the mechanism engage it again from above. The yellow hook's shape should be cammed inward as the rod enters the weight. In its relaxed position the hook stood a little too far out.

**Checked against the plate and caption.** The caption only covers the release. Nothing in Brown's section can lift a weight that lies on the bottom:
- the catch sits inside the bore after the trip;
- the probe foot is narrower than the bore.

So the lift is an undrawn reset (a leadsman or a hook from the vessel), and it is not modelled. The minimum lift is set by the probe. The foot hangs 1.23 below the catch seat, so the weight has to be raised about 1.37 (under its 1.5 radius) before the catch can pass under it without the foot tripping on the bottom.

**Loop.** One weight and one sounding per 13 s loop. Nothing leaves the view or teleports.
1. Brown's pose.
2. Descent, probe trip and drop. These are unchanged.
3. The rod rises out of the spent weight. The catch rubs up the bore and springs out over the top rim.
4. The same weight is raised 1.37 straight up on the rod's line and held.
5. The rod is lowered into it. The top rim cams the barb's sloped back inward, the barb rides down the bore, and it springs out under the lower opening. The probe foot is still 0.12 clear of the bottom.
6. The rod is taken up 0.08 until the finite seat meets the weight, which is at rest.
7. The rod carries the weight back into Brown's pose.

**Speed through the rims.** Rim windows are solved from the catch and weight contact outline (`geometry.rimWindows`). The rod crosses each window at a creep of 0.45/s using C1 cubic-Hermite tracks, so the cam-in (0.4 s) and the snap-out read clearly. The largest catch step is under 0.01 rad per 1/1540 of the reload.

**Removed.**
- The second weight.
- The station drift and the travelling tone bands on the bottom. The bottom is now a plain, fixed 30-long block.
- The run down the line.

**Hook reach.** The catch's lower limb (seat, sloped back and tip), the lower arm plate and the finite seat are all tucked in by 0.08 rad about the pivot. The relaxed seat now stands 0.18 beyond the bore instead of 0.24. The trip geometry was re-solved from it:
- release angle -0.188;
- release at 4.41 s;
- the seat still carries the weight with an upward normal (release test passes).

**Captures** (plate: `public/engravings/mm_247.png`):
- **Before:** `tile-before-247.png`
- **After:** `tile-after-247.png`, covering the phases, the cam-in, the snap-out, and rotated views at yaw ±40° and pitch ±20°
- **Close-ups:** `tile-c247.png` (cam-in at 9.25–9.55 s, snap-out at 10.55–10.75 s, seated at 11.5 s) and `cmp247.png` (relaxed hook before and after, plus the catch sprung out under the lifted weight)

**Tests.**
- `tests/movement-247.test.mjs`: 9 pass. The station, spare-weight and band tests were replaced by one p98 reload test covering:
  - the lift is slight;
  - no source-model catch/weight contact on reload;
  - the cam-in lasts 0.2 s or more;
  - the probe never touches the bottom on reload;
  - the seat meets the weight at rest;
  - one continuous weight that is never in the bottom;
  - the rod stays in view.
- `tests/release-mechanism-working-parts.test.mjs`: 5 pass. The mesh pair audit gained 61 samples across the reload window.

**Screens.**
- Seams: 0.
- Coincident faces: 0.
- Body intersections (with `NODE_OPTIONS=--max-old-space-size=14000`): worst solid 0.
- Disconnected parts: only the fixed bottom is reported as "floating" while the weight is held up. The near-miss list is the pre-existing one.

**Build time.** About 150 ms, up from about 100 ms (the rim-window scan).

**Residuals.**
- The lift is prescribed and undrawn: the weight rises and hangs on nothing visible for about 2.8 s.
- Spring force, friction and snap timing are prescribed.
- The finite seat sits 0.003 lower than the source contact model's conservative seat. The mesh audit shows no penetration.

## 251: pile-driver releasing hooks

**User finding.** The curved members between the tongs (`/dev/shm/p98/img/105.png`, marked in red) are springs. They push the blue arms outward away from the top, so the catch engages.

**Checked against the plate.** Seen on a 4× crop (`plate251z.png`), the two members meet in a V seated in the dip at the top of the lower hatched piece. Their free ends curl up to the inside of each jaw arm just below the crossbar. The white gap between the two hatched stem pieces is where the leaf passes through the stem.

**Change.**
- **The leaf.** The p96 cast "stirrup bands" are removed from the rope-block casting. They are replaced by one bowed steel leaf spring:
  - a closed strip 3.2 px thick in the plane, with its own vertices per face so the edges stay sharp, and capped ends;
  - seated at its middle in the pivot block's V, embedded about 0.8 px;
  - z from -0.5 to -0.04, so it overlaps the jaws' depth and the casting's;
  - dark steel, like 247's spring.
- **How it deflects.** Each arm deflects as an end-loaded cantilever, with shape (3u² − u³)/2 from the seat, so the seat and its tangent stay fixed. The tip deflection is solved against the jaw's inner edge with 0.15 px running clearance. It is tabulated over the jaws' opening range, from +3.3 px when closed to −8.2 px at slot B.
- **What it does.** The leaf always bears on the arm and pushes it outward. That holds the feet closed under the T head. Slot B squeezes the horns in, and the leaf visibly flexes by 11.5 px at each tip. The closing law text now credits the spring instead of the jaws' weight.
- **Load path.** With the bands gone, the crossbar stem needed a new connection to the pivot block. A narrow web (x ±7 px, z from -0.69 to -0.52) sits behind the leaf's slot. It stays clear of the leaf and has no shared faces.

**Captures:**
- **Before:** `tile-before-251.png`
- **After:** `tile-after-251.png` (phases and rotated views) and `tile-b251.png` (close-ups closed at t = 0, open at slot B, the re-catch, rotated ±45°, and the back)

**Tests.**
- `tests/movement-251.test.mjs`: 8 pass. The new p98 test covers:
  - no casting bands remain;
  - the web sits behind the leaf;
  - the leaf never enters either jaw at 81 poses;
  - it always bears on the arm (gap under 0.5 px);
  - the tip travels more than 8 px.
- `tests/lifting-check-hook-working-parts.test.mjs`: 6 pass. This covers the stable buffers and the camera fit.

**Screens.**
- Body intersections: worst solid 0. The leaf is screened as a deforming part.
- Disconnected parts: only the pre-existing pile/anvil below the crop.
- Seams: 0.
- Coincident faces: 0.

**Build time.** About 320 ms, against about 280 ms at HEAD.

**Residuals.**
- The set-back web behind the slot is inferred; Brown's section shows an open slot there.
- The spring's force and preload are not solved; the leaf follows the jaw geometrically.
