# Pass 93, lane p93-fa: fixes for the 1–85 audit

Reviewer: Claude Opus 5.5, lane p93-fa. Date: 2026-09-28. Source audit: `docs/p93-audit-001-085.md`.

No git writes. Scratch files, captures and screen output are in `/dev/shm/p93/fa/`. Captures were made with `/dev/shm/p93/fa/shots.mjs` against a vite server on port 45961. The contact sheets are `/dev/shm/p93/fa/sheets/<id>.png`: plate, default, right, left, top, behind, and phases 0.33 and 0.66.

## File claims

- **Claimed and edited:**
  - `authored-belts.js`
  - `fusee-chain.js`
  - `conical-stud-geometry.js`
  - `star-mangle-guide.js`
  - `band-epicyclic.js`
  - `jointed-tappet.js`
  - `alternating-peg-pawl.js`
- **Claimed but not edited (released at the end of the lane):**
  - `ratchet-bevel.js`
  - `star-mangle.js`, `star-mangle-geometry.js`
  - `band-epicyclic-gears.js`, `band-epicyclic-geometry.js`
  - `jointed-tappet-contact.js`, `jointed-tappet-motion.js`
  - `alternating-peg-geometry.js`
  - `snap-counter-63-mechanism.js`
- **Deferred:** `authored-gears-core.js` and `authored-intermittent-core.js` are claimed by lane p93-f (in `/dev/shm/p92/claims`). The builders for 029, 031, 038, 043 and 063 live in those files.

## Per movement

### 076: stud D sat on the rim's outer edge (medium, fixed)
- **Verified:** on the plate, D stands inside the rim band, about 40% of the way out from the inner edge. The model's stud orbit is 2.321, which is forced by the strike geometry (a drawn-radius D flings B past vertical; see the factory comment). Before the fix, the orbit plus the stud radius equalled the rim's outer radius of 2.384, so the stud was tangent to the outer edge. The edge-mount screen flagged 4 studs with ratio 1.003.
- **Fix** (`jointed-tappet.js`): the rim band keeps Brown's measured width (744.9–921.1 px, 0.456), but is now centred on the stud orbit: 2.093 to 2.549, where it was 1.927 to 2.384. The stud, its orbit and the strike are unchanged.
- **Rebake:** `node scripts/bake-jointed-tappet-motion.mjs` (log in `/dev/shm/p93/fa/bake76.log`).
  - The driver is prescribed, so the trajectory rows came out byte-identical.
  - Only `physics.mass.driver` (53.0 to 57.1) and the `geometry` rim radii changed in `src/data/jointed-tappet-profile.js`.
  - The run converged at dt 3.125e-5, with minimum gap −5.6e-16 and final count exactly one tooth.
- **Captures:**
  - `sheets/76.png`
  - `z/76-stud.png` and `z/76-stud-obl.png` (stud mid-band, default and oblique)
- **Tests:** `tests/jointed-tappet.test.mjs` now asserts that the band is centred on the orbit at Brown's width. All tests pass.

### 077: wire-thin hook shanks (medium, fixed), light pegs (low, fixed)
- **Fix** (`alternating-peg-pawl.js`):
  - Each shank is now a flat bar with half-width 0.029, about 0.59 of a peg diameter. It was a 0.019-radius capsule.
  - The bar's square end stops 0.075 short of the socket centre. Its corners (0.080 out) lie inside the head's back wall (0.058–0.090), so the head keeps its 0.09 rim and nothing enters the socket.
  - The pegs and caps are now `PALETTE.frame` steel (they were `muted`).
- **Clearance against the recorded motion:** every pawl-outline-to-peg signed distance was checked at 3000 poses over the playback period (`/dev/shm/p93/fa/c77.mjs`, output in `c77-before.txt` and `c77-after.txt`).
  - The minima are unchanged: seated pegs 0.0000, upper 23 +0.0017, upper 22 +0.0128.
  - The only change is upper 21, which went from 0.2395 to 0.2313.
  - A rounded 0.029 capsule end did enter the socket (−0.008), which is why the bar ends square.
- **Not rebaked:** the recorded motion already predates the p90 heads. The pawl masses in the profile are the candidate model's, as recorded in the ledger.
- **Captures:** `sheets/77.png`, `z/77-hooks.png`
- **Tests:** a new test in `tests/alternating-peg.test.mjs` checks a mid-shank width of 0.59±0.02 peg diameters and dark pegs.

### 054: block A's channel z-fought with the running rim (medium, fixed)
- **Diagnosis:** the coincident mesh pairs were the running rim (mesh 1) and the crab-end linings (meshes 40 and 42), not the block. They coincided in two places:
  - the outer cylindrical face at r = 1.85, in both parts;
  - the concave running face, where the collar-envelope surface has 0.0001 clearance in both.
- **Fix** (`star-mangle-guide.js`, used only by 54): the rim's `radialEnd` is now 1.847 (was 1.85) and its running-face `clearance` is 0.0015 (was 0.0001). Motion is analytic and nothing reads the rim clearance.
- **Coincident-face screen:** 2 flagged pairs (contrast 0.44) became 0 (`/dev/shm/p93/fa/cf2.json`).
- **Captures:** `z/54-block.png`, and `z/54-peak.png` / `z/54-peak2.png` at the former peak points and phases.
- **Tests:** a new test in `tests/star-mangle.test.mjs` asserts the rim stand-off.

### 057: pointed ring teeth (medium, forced, kept), pale shaft ends (low, fixed)
- **Tooth count:** sampling the plate's ring along radii 124–128 px gives edge pairs every about 10.5°, which is 34 teeth. The auditor's "visibly more teeth" doesn't hold.
- **Why the ring teeth are pointed:** 18/10/34 on one orbit is not a standard train (a standard ring would have 38 teeth). The planet's single base circle forces one base pitch, so the internal operating pressure angle is at least acos(24/28) = 31°. The model runs at 35.0° internal and 17.1° external.
- **Why stubbing isn't possible:** the internal contact ratio is already only 1.11 (action length 0.336, base pitch 0.302).
  - The ring tip can't be raised without losing contact.
  - The ring root (2.045) can't be raised past the planet's tip reach (2.019).
  - Moving thickness from the planet to the ring (via `planetBaseHalf`) would close the ring's root gaps, which are already about 0.
- **Decision:** square, flat-topped conjugate ring teeth can't be made with Brown's counts. The involute is kept, recorded as forced, with these numbers. Non-conjugate square teeth would break the mesh.
- **Fix** (`band-epicyclic.js`):
  - The sun shaft, driver shaft, planet axle, planet collar and planet cap are now black steel (`PALETTE.ink`).
  - The planet cap radius is now 0.18, down from 0.265. It still retains the 0.131 bore.
- **Captures:** `sheets/57.png`
- **Tests:** a new test in `tests/band-epicyclic.test.mjs`. The existing contact and clearance tests pass.

### 046: pale fusee chain (medium, fixed)
- **Fix** (`fusee-chain.js`, used only by 46): the plates are now #4a4f52 and #353b3d, and the pins #5f6668. They were #b6bebb, #515c5b and #8c9997.
- **Captures:** `sheets/46.png`. The chain now reads as a dark chain in every view.
- **Tests:** a new test in `tests/fusee.test.mjs`. All fusee clearance tests pass.
- **Not changed:** the fusee step count (low). The fusee is a spiral groove, and `fusee-geometry.js` was not claimed.

### 003 and 004: black hub bosses and long axle stubs (low, fixed)
- **Fix** (`authored-belts.js`):
  - 003's spoked pulley now gets the shared `castSpokedHub` and a `spokedStubLength` stub, as on 1 and 2.
  - A new `castGuideHub` casts the solid guide sheaves' hubs (on 3 and 4) in the tread material, 0.02 proud of each face, with a stub 0.05 proud.
  - 003's drum shaft and 004's upright pulley shaft are unchanged. Brown draws 004's shaft ends.
- **Geometry hashes:** all 34 IDs the file builds were hashed before and after (`/dev/shm/p93/fa/hashbelts.mjs`). Only 3 and 4 changed; the other 32 are byte-identical.
- **Captures:** `sheets/3.png`, `sheets/4.png`, `z/3-hub.png`, `z/4-guide.png`
- **Tests:** a new test in `tests/belts-1-23-clearance.test.mjs`.

### 037: star-shaped pinch at each stud pole (low, fixed); rim notch kept
- **Diagnosis:** on every head, the pinion's tip sweep shaves the crown top by up to 0.0018. The relief is conservative (per triangle, the minimum over the triangle), so the pole takes the minimum of its 64 fan neighbours, and the first-ring normals spread over about 10°. That spread is the "+" star.
- **Fix** (`conical-stud-geometry.js`, used only by 37): front-cap vertices whose relief is under 0.0025, away from the creased rim, now shade with the analytic crown normal. Positions and clearances are unchanged.
- **Rim notch kept:** the flat notch at the rim is the working relief cut (0.01–0.02 deep), so it stays.
- **Captures:** `z/37-stud2.png`, `z/37-studs.png`
- **Tests:** a new test in `tests/conical-stud-clearance.test.mjs` requires the first-ring normals to be within 5° of the pole's. The clearance test still passes (minimum stud clearance 0.00035).

### 049: pawl hung on a bare pin (low, not changed; the auditor is contradicted by the plate)
- The plate draws each pawl as a dark block beside the ratchet, and the pin spanning an open gap of about 30 px to the arm, with the pin standing out beyond the arm on both sides. The model matches.
- The pin is concentric with the arm's end arc by construction (`armTurn` maps the arc centre onto the pin).
- **Capture:** `z/49-before.png` (default, side and front zooms)

## Deferred: files owned by lane p93-f
- **029** (spiral rib): `authored-gears-core.js` (`makeSpiralDiskWheel`).
- **031** (worm hand): `thinRib: -1` and the worm/wheel spin signs are in `authored-gears-core.js`. The shared helper alone can't flip the hand and keep the mesh conjugate.
- **038** (flat frame link): `authored-gears-core.js` (`variableSectorGears`).
- **043** (camera roll, upper hub collar): `authored-gears-core.js` (`angularBevelGears`).
- **063** (pale pins, hairpin spring): the meshes are built in `authored-intermittent-core.js`.

## Screens (IDs 3, 4, 37, 46, 54, 57, 76, 77)
- **Coincident faces:** 0 flagged pairs on all eight (`cf1.json`, `cf2.json`, `cf3.json`). 54 had 2 before.
- **Edge mounts:** 0 flagged. 76 had 4 before: its studs at ratio 1.003.
- **Disconnected parts:** the counts equal the audit's for every ID except 76, which went from 5 near-misses to 7.
  - The two added near-misses are the unchanged tappet cheek/web and cap gaps (0.09, 0.091).
  - They now fall under the screen's relative threshold only because the larger rim grew the model's diagonal.
  - 76's detached part is still the fixed pivot C, as in the audit.
- **Loop seams:** 8 checked, 0 above tolerance.
- **White parts:** 0 hits.

## Tests
`node --test` was run on these files:

- `jointed-tappet`
- `alternating-peg`
- `star-mangle`
- `band-epicyclic`
- `conical-stud-clearance`
- `fusee`
- `belts-1-23-clearance`
- `gears-24-46-source-match`
- `tappet-stud-stop`

All pass (log in `/dev/shm/p93/fa/tests1.log`, plus rerun logs).
