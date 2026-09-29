# Pass 104, fix lane g5 (426–507 audit findings)

Reviewer: Claude Opus 5.5, pass-104 fix lane g5. Date: 2026-09-29. Source audit: `docs/p104-audit-426-507.md`. No git writes.

- **Scratch and captures:** `/dev/shm/p104/g5/`. After captures are in `after/`:
  - `sheet-ID.png`: plate, default, right, left and back views.
  - `z*.png`: zooms.
  - `strip460.png`: the 460 pour.
- **Server:** Vite on port 46095.

## Claimed files

authored-persian-irrigation-wheels.js, authored-eisach-pot-wheels.js, authored-stream-driven-archimedes-screws.js, authored-temperature-air-machines.js, authored-reaction-ferries.js, authored-gasometers.js, authored-epicyclic-trains.js, compound-epicyclic-corrections.js, authored-volute-water-wheels.js, authored-old-rotary-pumps.js, authored-common-windmills.js, wind-rotor-working-parts.js, authored-barker-reaction-mills.js, authored-robertson-jacks.js, authored-bailing-scoops.js, authored-bourdon-pressure-gauges.js, elastic-gauge-working-parts.js, and the new files flowing-stream-surface.js and face-gear-conforming.js.

I didn't touch the shared helpers `water-stream.js` or `face-gear-geometry.js`.

## Shared-helper identity

These helpers are shared with other movements, and I edited them:
- `wind-rotor-working-parts.js` (also 484 and 486)
- `elastic-gauge-working-parts.js` (also 498)
- `compound-epicyclic-corrections.js` (also 506)

For each shared movement (and 026), I hashed the geometry and world matrices at two phases, once with the HEAD copies of these helpers and once with the edited copies (`/dev/shm/p104/g5/hash.mjs`). The hashes match for 484, 486, 498, 506 and 026.

## Fixes

### 441, 442, 443: the driving stream now moves (medium)

- **New shared helper:** `src/simulation/flowing-stream-surface.js`.
  - It makes one streaked `WaterStream` body (the same material and scroll as 431's flow sheet).
  - The body has an elliptic section, running upstream to downstream just under the static water volume's free surface.
  - Its edges never lie on the volume's walls, and its top sits under the volume's top face.
  - Its streaks move at the path speed and loop seamlessly over the movement's cycle.
- **441:** runs left to right, in the direction the counter-clockwise wheel's bottom moves.
  - The body is deep (half-thickness 0.8), so its streaks read through the front face in the straight elevation view. They echo Brown's horizontal hatching.
  - The stream speed is now 1.5 × the float-tip speed (1.95). It was 1.25, slower than the floats' 1.30.
- **442:** runs rightward. Stream speed is 1.5 × the pot-rim speed (1.91; it was 1.30 against the pots' 1.27). Normal detail was raised so the streaks read from the oblique default view.
- **443:** runs along +z, the paddle-driving direction already in the state. The speed is unchanged at 1.34, about 1.5 × the paddle-tip speed.
- **Fluid-motion test** (water rendered alone at phases 0.20 and 0.26; ImageMagick AE, 1% fuzz):

  | Movement | Changed pixels (was 0) |
  |---|---|
  | 441 | 62,436 |
  | 442 | 37,386 |
  | 443 | 120,179 |

- **Captures:** `m441.png`, `m442.png`, `m443.png`, `fl442.png`, `fl443.png`, and `after/sheet-441..443.png`.
- **Loop seams:** 0.

### 447: the river current (low)

- The same helper, as a thin sheet 0.03 under the river surface.
- It runs downstream (+x, Brown's arrow) at the stream speed of 1.15, between the banks.
- The factory's `update` now scrolls it.
- 65,896 pixels change between phases (was 0). Captures: `m447.png`, `after/sheet-447.png`.

### 469: the face-gear teeth are regenerated (medium)

- **Cause:** the teeth came from a coarse polar height field (10 × 48 × 480) with a neighbour dilation.
  - The steep, twisting flanks crossed grid cells diagonally, which gave stair-stepped shading.
  - With the chosen face width (inner radius 0.43, outer 0.63), the cut leaves no top land at the extremes:
    - at the outer end the teeth point;
    - at the inner end the tip is undercut 0.016 below the tip plane.
  - The grid tore these tips into slivers.
- **New generator:** `src/simulation/face-gear-conforming.js`.
  - It uses the same shaper-generation process: the pinion's actual polygon rolled against the blank.
  - Each of 21 radial rows is cut on a fine line (480 samples over the pitch, 400 rotation steps).
  - Each row is then resampled by arc length as left flank, top land and right flank. The rows form a regular strip that follows the flanks, with the tip corners as exact vertices.
  - Crease normals keep the land/flank edge sharp and the flanks smooth.
- **Topping:** where the cut leaves a land narrower than 0.004, that row's tip is lowered until the land is 0.004 wide, as on a topped face gear. There are no knife points and no torn tips.
- **Clearance:** the cutter is the pinion grown 0.0016 normal to its profile, plus 0.0002 along the face axis.
  - A clearance along the axis alone vanishes on near-axial flanks.
  - Without this there was a 0.0003 interference, caused by chords between rows in the undercut zone.
- **Flank gap re-check:** actual rendered pinion and tooth meshes, 49 poses over one pinion tooth period, both directions.
  - Minimum separation: **0.00105** (was 0.00098).
  - At every pose the closest approach is ≤ **0.00135** (was ≤ 0.0012).
  - The test bounds are 0 and 0.0025.
- **Cost and topology:** the tooth mesh has 1,690 triangles; the whole model builds in about 0.47 s in Node. The topology and winding are the same as before, so the solid-surface checks apply unchanged.
- **Captures:** `469cmp.png` (audit zoom, before and after), `469m.png` (three zooms and the default view).

### 480: sleeve/base cut faces (low)

- A's base now butts on sleeve a's outer wall instead of running half into it.
- The two cut faces meet edge to edge on the section plane.
- The coincident-faces screen flags 0 (was 1). Capture: `after/z480.png`.

### 505: arm D's central eye (low)

- The eye is bored to the pivot hub's outer radius less 0.0015 (0.2785). It used to be bored to the hub's own 0.171 bore, which duplicated that cylinder.
- The coincident-faces screen flags 0 (was 384 triangle pairs).
- The 503/504 contact report was regenerated: results identical, source hash updated. Capture: `after/z505.png`.

### 507: slow-shaft pedestal (low)

- The post is now 0.26 along the shaft, inside the boss's 0.28, and 0.28 across it, inside the boss's 0.48.
- Its top (y −0.17) is inside the boss and below the bore, and the foot flare is kept.
- The disconnected-parts screen reports 0 lips (was 1).
- The 506/507 gear report's results are unchanged; the source hashes were refreshed.
- Captures: `after/z507.png`, `after/z507b.png`.

### 437: volute water on the vane faces (low)

- The confined water's inner face is 0.006 inside the vanes' inner ends, so it no longer lies on their end faces.
- Coincident faces: 0 (was 4). Capture: `after/z437.png`.

### 455: hinge pins (low)

- The pins' back ends stop 0.005 inside the rear web.
- Coincident faces: 0 (was 2). Capture: `after/z455.png`.

### 485: square pedestal on the dome (low)

- The outer windshaft bearing is now one round collar concentric with the shaft, running 0.03 inside the dome. Brown draws the shaft coming straight out of the dome.
- The undrawn square pedestal is gone.
- The inner bearing's pedestal remains, hidden inside the dome.
- Coincident faces: 0 (was 1). Capture: `after/z485.png`.

### 438: bracket lip and shaft neck (low)

- **Bracket:** it stood 0.32 off the shaft's centre line. It now runs on that line into the collar, so the 0.063 lip is gone (disconnected-parts screen: 0 lips).
- **Step seat:** the step block's round hole is now a conical seat.
  - It matches the shaft's closed cone (25.9° half-angle) with a 0.002 normal gap.
  - The neck grows from 0.029 to 0.129.
  - The screen still flags it as a hinge neck. That is inherent to a cone-point step bearing: the only contact is the cone in its cup.
- Captures: `438m.png`, `438s.png`.

### 467: wing and plunger (low)

- The butterfly wing gains a round hub (r 0.10, on the screw axis) that encloses the shaft end.
- The plunger's eye is 0.20 deep, deeper than the 0.18 plunger. The pin still stands 0.015 proud of the eye's front face.
- Lips: 0 (was 2).
- `tests/movement-467.test.mjs` now expects the wing plus its hub. Capture: `after/z467w.png`.

### 460: the pour (low)

- The high dwell now runs from 0.40 to 0.56 (was 0.40–0.50). The empty scoop's lowering is correspondingly shorter.
- The pour shows in 3 of 20 sampled phases (was 1).
- The carried water already drains continuously into the pour. Its absence from 0.56 to 0.90 is correct: the scoop is empty then.
- **Residual:** from the default front view the pour is still largely edge-on (already in the ledger).
- `tests/movement-460.test.mjs` samples the discharge at 0.48, the new mid-dwell.
- Captures: `after/strip460.png`, `after/z460.png`.

### 499: sector end teeth (low)

- The toothed arc now ends at gap centres, so both end teeth are whole. It is extended 0.15 pitch at the lower end and trimmed 0.22 pitch at the upper end.
- **Phasing: I disagree with the audit.** A probe shows the mesh condition holds at every phase: the sector's tooth fraction plus the pinion's gap fraction always sums to 0.5 (mod 1).
  - At phase 0.5 the pinion tooth is in a sector gap, in both the zoom and the probe.
  - The audit's "pinion tooth on a tip" reading comes from the viewing angle.
- Captures: `after/z499cd.png`.

## Screens and tests

- **Coincident faces** (`/dev/shm/p104/g5/cf.json`): every targeted fight is gone. The unrelated pairs in 443, 484 and 498 are unchanged.
- **Disconnected parts** (`disc.json`): no new detachments, slivers or lips. The 438, 467 and 507 lips are removed; 438's step neck is widened.
- **Loop seams** (441, 442, 443, 447, 460, 469): 0.
- **Tests:** 34 targeted test files were run, 248 subtests. All pass after the two test updates (467 and 460).
- **Validation reports regenerated:**
  - `docs/validation/503-504-contact-solids.json`: results identical, hash updated.
  - `docs/validation/506-507-gear-solids.json`: results identical, hashes updated.
