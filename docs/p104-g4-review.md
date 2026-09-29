# Pass 104 lane g4 review (349, 269, 281, 282, 316, 317, 323, 355, 384, 400 and lows)

- Reviewer: Claude Opus 5.5, lane p104-g4 (lead: 349, 269, 355, 384, 400; sub-forks A: 316/317, B: 323/281/282, C: 259/261/267/304/305/352/403 lows, D: 326/327/328/330/333 lows), 2026-09-29, from HEAD ad638ba. No git writes.
- Captures are under `/dev/shm/p104/g4/{M,A,B,C,D}/`. Vite port 46094.
- Claimed files: see `/dev/shm/p104/claims/*/owner` = p104-g4 (21 authored factories plus the shared helpers `gyroscope-working-parts.js` and `differential-thread-solids.js`).

## 349 (high) — authored-jointed-parallel-rulers.js
- **Verified numerically first.** A vertical-ray raster (0.02 × 0.01, offset off the boundaries) over phases 0.55–0.95 found **no solid overlap** before the change: at h = 1 the main ruler edges lie exactly on the arrow bar's edges (z = ±0.37), the two tails meet edge to edge at z = 0 and the arrow nests in their V with zero clearance. The audit's "0.37 overlap" came from bounding boxes (the ruler tails reach z = 0 beside the arrow, not over it). The visible fault is real, though: at the closed dwell the two same-coloured coplanar rulers join seamlessly and the bar reads as an inlay in one plate.
- **Change.** The 3D path now stops at h = 1.05 source units (`closedHalfSeparation`), not the official flush 1.0. The rulers rest 0.037 (world) off the bar and the tails 0.074 apart, so the three bars stay visibly separate. The quintic schedule scales its travel (2 → 1.05), keeps C2 continuity, both dwells and the period. Metadata: `sourceAnimation.closedStop`, `timingRefinement.changesExtremaOrDwells: true`.
- **Captures:** `/dev/shm/p104/g4/M/349-tile.png` (before, phase 0.8: merged plate), `349a-tile.png` (after: phase 0.8 default, zoom, oblique; phase 0.25).
- **Tests:** `movement-349` updated (closed dwell = 1.05; raster tolerance) and a new no-overlap test (40 phases, ray raster: no ruler/bar or ruler/ruler overlap; closed bar gap 0.02–0.05, tail gap 0.04–0.1). `movement-349`, `ruler-349-367-solids`: 15/15.

## 269 (medium) — authored-mutilated-racks.js
- The fit box now runs from the closed end at the left stroke limit to the rod's end at the right one (`0.92·(driveRodEnd − qmin)`), so the rod and collar stay in view at every phase (motion max x 7.85, box 7.86).
- Captures: `M/269-tile.png` (phases 0, 0.3, 0.55, 0.8). Test: `movement-269` now includes rod and collar in the in-view check (pass).
- Not done: the p101 low (collar as a fixed guide). A fixed guide right of the bridge at the far stroke limit would sit ≥ 3 units from where Brown draws the rectangle, so it is not a clear fix.

## 355 (medium) — gyroscope-working-parts.js (shared with 356; 356's branch untouched)
- The fit box is centred on the pillar/pintle axis (x = z = 0) and spans the ring-and-disk's swept cylinder (x ±5.0, y −2.48…3.55) with a half-depth proxy (z ±2.2) for the foreshortened sweep; the 0.55 distance scale is gone.
- Captures: `M/355-tile.png` (phases 0, 0.15, 0.3, 0.5, 0.7, 0.85): the rotor stays in frame throughout, pillar centred.
- Test: `movement-355`'s pass-94 test replaced by one asserting the centred box and in-view x/y at 24 phases (pass); `movement-356`, `gyroscope-working-interfaces` pass.

## 384 (medium) — authored-helicographs.js
- The fit box is the arm's swept disc round the fixed point (x ±5.6, depth proxy ±3.2).
- Captures: `M/384-tile.png` (phases 0, 0.2, 0.4, 0.5, 0.6, 0.8 with the plate). New test in `movement-384`: every visible part is inside the box in x and y at 48 phases (pass); `helicograph-working-parts` pass.

## 400 (medium) — authored-four-motion-feeds.js
- The cup socket is carried by one flat strap (single extrusion, z ±0.08) running under the cup to a bored bearing boss (r 0.22, bore 0.1205) round the camshaft's left end. This also gives the camshaft one visible bearing. The strap is buried in the cup's lower wall and in the boss wall; the shaft runs 0.08 proud of the boss.
- Captures: `M/400-tile.png` (default, rotated, zoom, underside oblique).
- Test: new `movement-400` test (strap enters the cup wall and ends in the boss; boss concentric on the shaft). `movement-400`, `four-motion-feed-solids`: 12/12.
- Screens (269, 349, 355, 384, 400): 0 flagged coincident pairs, 0 slivers or lips; 400 has 0 detached. 269's 1 detached / 34 near-misses are unchanged geometry (camera-only change).

---

## p104-g4 sub-fork A: 316 / 317 (authored-compensation-pendulums.js)

Reviewer: Claude Opus 5.5, p104-g4 sub-fork A, 2026-09-29.
Files: src/simulation/authored-compensation-pendulums.js; src/simulation/differential-thread-solids.js (claimed p104-g4; only `export` added to `trapezoidThread`, so geometry is byte-identical for 260/266/275: the regenerated docs/validation/260-266-275-thread-solids.json changed only the file hash, POSES=33 kept, all results identical).
Tests: tests/movement-316.test.mjs, tests/movement-317.test.mjs, tests/pendulum-journals.test.mjs (317 laminae sampled live per pose).

## 316
- Thread: solid V (trapezoid) thread from the shared `trapezoidThread` builder (root 0.082, crest 0.022, pitch 0.10, root sunk 0.006 in the rod), running from the handle block through the cap boss into the neck. It is carried by the jar assembly, so the boss never slides on it. Rod radius 0.095 -> 0.16 (Brown's rod is about 0.39 wide).
- Jar: one closed lathe (thick base, inner base fillet r 0.30, body, S-shoulder, neck r 1.18/0.90, lip r 1.32). The separate glass bottom disc is gone.
- Cap: Brown's inverted-U stirrup, a single flat extrusion 0.60 deep. It has a chamfered top, a plug in the neck and a leg outside it on each side, and the lip sits in the groove with 0.02 clearance. A round bored boss (r 0.45, proud 0.05) carries the thread. There is cement packing (annular-sector pads) between the neck and each leg, two side screws (shank and square nut) through the legs, and the small screw head on the cap top. The curved straps, the grey clamp boxes and the crossbar are removed.
- Handle: a bored square block with Brown's pin ends; a tapered round arm to a ball on the left; on the right a tapered arm carrying a vertical index plate (rounded box 0.07 x 1.1 x 0.56). The handle is at Brown's height (py 82), with the thread visible between the handle and the cap.
- Mercury: one lathe with a rounded bottom edge concentric with the glass fillet. Only its top face moves (the fill height is the analytic value), so from below there is no dark disc.
- Screens: disc 0 detached. The 2 near-misses are intended clearances: index plate/cap 0.057, and rod/boss where the thread fills the bore. Coincident faces: 0. Body intersections: worst is the thread root sunk 0.006 in the rod (intended). Loop seams: 0.
- Captures: 316-after-tile.png (plate, default, zooms front/right/left, below, right, back, phase 0.75); 316-*.png.

## 317
- Rod and C: one flat extrusion (0.40 wide, 0.30 deep, z = 0). Brown's collar shoulder flares through two concave quarter-ellipse arcs, tangent to the bar top at x = +/-1.07. The flare is fitted to the least-bent bar, so the toe never lifts off; it is embedded 0.03 in the steel lamina. It stretches with the rod's thermal extension (at most 0.4%). The old wire rod at z = -0.16 and the orange cube are gone.
- Bar C: each lamina (steel above, brass below, each 0.135, i.e. Brown's 0.27 bar) is one bent strip swept on the live parabola. It runs through both W to rounded knob ends (a quarter-round per lamina, forming one round knob). The shared interface faces are omitted, so there are no coincident internal faces. The 40 boxes per layer and the separate end stubs are removed.
- W: a block extrusion whose passage fits the bar section: +0.004 all round, plus 0.021 for the worst sag across W (was 0.31 for a 0.21 bar). Countersunk brass screw head on top (was a tall shank).
- M: one smooth extrusion (48-segment shoulder arcs r 0.62, bevel 0.04), no longer the vertex-warped faceted body. Its top meets the bar underside at C (bob outline raised 0.115 above the mass-model box; the mass model is unchanged).
- Lower screw: a round stub with a shared-builder V thread, and a bored round nut, at z = 0.
- Screens: disc 0 detached. The 2 near-misses are the screw heads above W (0.065, rigid). Coincident faces: 0. Body intersections: 0. The laminae report as 2 open meshes because each omits the interface it shares with the other (together they form one closed bar). Loop seams: 0.
- Captures: 317-after-tile.png (plate, default, C zoom, W zooms, side, top, lower screw, phase 0.25); 317-*.png.

## Residuals
- 316: the mercury volume uses the cylinder mass model; the rounded bottom removes about 0.5% of the volume (invisible). The index plate is a plain plate (Brown gives no graduations).
- 317: C is 0.30 deep on a 1.02-deep bar (from above it reads as a thin fin). The bob's top is raised 0.115 above its mass box so it meets the bar as drawn.

---

## p104-g4 sub-fork B: 323, 281, 282

## 323 (authored-parallel-rulers.js, rollingWheelParallelRuler only)
- Each wheel A is now one flat extrusion (extrudeOutline, smooth walls, crisp corners) with 36 shallow V nicks
  (depth 0.028, 70-degree V) cut in the rim at the pitch radius; bored 0.084. The 16 loose nick boxes and the
  8 face-spoke bars per wheel are gone (arrays kept empty for API). Nicks double as the rolling cue.
- The two loose cross-rails per housing are replaced by one rectangular frame extrusion lying on the ruler top
  round each wheel aperture (Brown's drawn rectangle); its short sides are 0.01 wider than the journal standards,
  so no coplanar faces.
- Collar "B": NOT added. The plate (zoom plate323z.png) shows letter B on the ruler and a small circle lettered
  C on the axle; caption says B is the ruler, C the axle. source-presentation already removes the old
  identification collar for this reason. Auditor's "collar B" is a misreading.
- 322/367 geometry byte-identical: hash of all visible mesh roles+world matrices+positions at t=0,0.37,1.9
  (hash.mjs): 322 9276e89581adc3d8, 367 f0934308f5f6b475 before and after; 323 2803aa4c -> 0cfbddd3.
- Captures: a323-tile.png (default, oblique, wheel zooms, top), before b323-def.png.
- Screens: disc 323 near-miss 60 -> 4 (only axle-over-frame and end-nut clearances), lips 1 -> 0; cf 0.

## 281 (authored-grooved-disk-followers.js)
- The fulcrum brace behind the disk is now one extrusion from the shared standardWithEye outline
  (ratchet-bar-working-parts.js, unmodified): bar half-width 0.11, round eye r 0.36 concentric with the r 0.24
  fulcrum pin, tangent fillets r 0.10; bore 0.236 (pin pressed through). Lower end still in the rear bearing.
- Rear bearing 0.005 deeper each side (-1.105..-0.775) so the A-frame leg braces' end faces no longer z-fight
  with it (cf screen had 2 pairs, now 0).
- Hub "seat in braces": the hub runs in the rear bearing with a 0.012 bore clearance; that is a running fit,
  left as is (screen reports it as bore-clearance, not detached-float).
- Captures: a281-tile.png (default, back, eye zooms, right).

## 282 (authored-slotted-disk-levers.js)
- Pulley bracket now ends in a round frame-grey boss r 0.13 concentric with the axle, running from behind the
  bracket rod (z -0.50) to 0.005 behind the pulley hub's rear face. Axle trimmed: z -0.20 (seated in the boss)
  to 0.015 proud of the hub's front face (was a 1.2-long bare rod from -0.55).
- Rack recoloured PALETTE.muted steel grey (was 0.62 x lever blue), distinct from the blue sector and from the
  darker frame-grey guides.
- Captures: a282-tile.png (default, right, two pulley zooms, sector/rack mesh zoom).
- Screens: disc unchanged vs p104 audit (0 detached; 1 pre-existing frame sphere sliver; 3 lips); cf 0.

## Tests
- movement-323: wheels one body, 36 nicks, no nick boxes/spokes, frame not rails.
- movement-281: brace eye concentric with fulcrum, eye radius > pin + 0.08, one extrusion.
- movement-282: new test (boss concentric, gap < 0.01 to hub, axle seated and just proud, rack grey).

---

## p104-g4 sub-fork C: low findings (259, 261, 267 lows, 304, 305, 352, 403)

Captures: /dev/shm/p104/g4/C/NNN-{before,after}.png (made with z.sh on port 46094).

## 259 (authored-pulley-forms.js)
- Pale "crack" glints on the lit notch flanks were specular: 259's own pulley material (local to notchedVGroovedRoundBandPulley) went metalness 0.16->0.04, roughness 0.53->0.9. Notch floors now stay orange.
- 255-258 byte-identical: geometry/matrix/material hash (hash.mjs) before/after equal: 255 c130c1b224fd7650, 256 b64a7b0606ab7a09, 257 bddbdb9e0e164cfc, 258 a210c62a624cc7ce. 259 changed (af39.. -> 65e4..).
- Captures: 259-before.png, 259-after.png.

## 261 (authored-combination-drives.js)
- The crank arm's hub end was an arc of exactly the hub radius (0.13), sharing B's hub cylinder face (the z-fight). The arm now ends in a bored eye r 0.175 (bore = hub + 0.004) clasping the hub, straight edges meeting the eye.
- Coincident-faces screen: 1 visible pair -> 0. Captures: 261-after.png.

## 304 (authored-stud-escapements.js)
- Deleted both loose rear bearing discs. Wheel arbor now ends at z -0.26 (hub back -0.22); pallet arbor ends at plate back - 0.04 (was 0.72 behind the collet, into empty space). blocks.wheelBearing/palletBearing removed.
- Disconnected screen: the pallet group was already "detached" (frameless, documented); the bearing just drops out of that list. Captures: 304-after.png (default, behind, oblique).

## 305 (authored-single-pin-escapements.js)
- Start phase: timeOrigin += 0.39 period, so t=0 is lower-corner-impulse with the pin at 357.9 deg (3 o'clock in the neck corner, as the plate) and the pendulum at 3.5 deg (was pin at 103 deg/11 o'clock with pendulum upright). Stays periodic; no motion change.
- Bushes: brass (PALETTE.brass) instead of 3d6e86 on the 315f78 plate.
- NOT done: the "notched suspension stub with a gap" — that is Brown's broken-rod squiggle; the rulebook forbids rendering break-off notation, so the continuous rod is correct.
- Test updated: movement-305 now asserts the Brown start pose (mode, pin bearing < 4 deg, pendulum < 4 deg) and that the upright pose (t = -0.39 P) is mid upper impulse. Captures: 305-after.png.

## 352 (authored-redirected-windlasses.js)
- Handspike 0.075 square x 1.68 -> 0.11 square x 1.88, centred on the barrel axis. Plate: spike ~205 px vs barrel 73 px tall (2.8x; model barrel 0.82 -> 2.3), bottom end reaching the A-frame feet, so length is capped at the feet (-3.19 vs feet -3.22). Brown draws a thin stick, so 0.11, not the auditor's 0.15/2.5. Captures: 352-after.png.

## 267 lows (authored-friction-clutches.js) — arm direction untouched
- Front "empty black tube": the shaft is solid; its front-face disc was carrier blue, reading as the carrier seen through a bore. Now steel grey (PALETTE.muted). Captures: 267-after.png.
- NOT done: spring seats/leaves as curved springs folded into the carrier. Their placement depends on which side of the arm the spring bears, which the pending 267 arm-direction decision will change; do it together with that fix.

## 403 (authored-cyclographs.js) — not changed
- The arc is not animated: it is a static, fully drawn tube at every phase. At Brown's apex pose it is hidden under the rules: the arc's bulge above each pin-to-apex chord is 0.443, while the rules are 0.40 wide, so only 0.04 peeks out. At plate scale Brown's rules are about 16 px = 0.24 wide (pass 90 took 0.055 x the model rule length, 7.84, but the model rules are longer than Brown's so they reach the pins through the full stroke). Narrowing to ~0.24 would show the arc as in the plate, but it reverses the pass-90 widening (test movement-403 line 379 pins width/length > 0.05), so it needs a lead/user call.

## Screens
- coincident (259,261,267,304,305,352): only 304's two pre-existing pallet-bit/plate pairs, area 1e-5, unchanged from the audit run.
- disconnected: no new detached/near-miss vs the audit run (261 nm 4, 304 nm 27, 305 nm 3, 352 nm 9; 304 pallet group detached as before, documented frameless).
- No saved validation reports or bakes fingerprint these files.

## Tests
- New asserts: movement-261 (bored crank-arm eye clears the hub), movement-304 (no rear-bearing roles; arbors end just proud of hub/plate), movement-305 (Brown start pose), movement-352 (spike length/centring/feet/thickness).
- Ran: movement-259/261/267/304/305/352, pulley-family-review, pin-escapement-working-solids, friction-clutch, friction-family-working-solids, windlass-flange-clearance, windlass-hardware, spatial-linkage-solids, cord-traverse-working-solids: 99/99 pass; then 261+304 (21/21) and 352 (9/9) after the new asserts.

---

## p104-g4 sub-fork D: lows 326, 327, 328, 330, 333

Captures are in /dev/shm/p104/g4/D/. Screens (before: `*-before.json`; after: `bi-a/disc-a/cf-a`, `bi330/disc330/cf330`, `bi333/disc333/cf333`):
- Body intersections: 0 solid overlaps for all five (unchanged).
- Coincident faces: 0 flagged for 326, 327, 330 and 333. For 328, the one tiny pre-existing internal pair (8.6e-5) is unchanged.
- Disconnected parts: 0 detached for all five.
  - 330's one lip (the fork crank-eye boss) is pre-existing and documented.
  - 333's near-misses went from 4 to 7. The new ones are the intended 0.02 running layer clearances (beam/centre link, beam/rocker, centre link/lower bar, rocker/lower bar).
- Loop seams: 5 checked, 0 seams, 0 pops.

## 333: bare pins M and R
- **Change:** restacked the links in `doubleParallelMotion` only. Each link rides 0.02 in front of the part it pivots on.
  - Centre link M-N-Q and rocker R-W now share the first layer in front of the beam, at z 0.29 (was 0.77 and 0.58). They never come near each other.
  - Lower bar R-Q is at 0.47 (was 0.98).
  - R's lug now stands directly behind the rocker (z −0.11..0.19, was 0.18..0.48).
  - Pins end 0.02 proud: M runs −0.32..0.39 (was 0.87) and R runs to 0.57 (was 1.08).
  - The O-M bar, the beam and rod P are unchanged.
- **Byte-identity:** 332 and 336 are identical to HEAD by a geometry, matrix and colour hash over three phases:
  - 332: `6c04612d2815a9fe`
  - 336: `0136a3983e147d0c`
- **Captures:** `333-after.png` (default, right, left, top).
- **Tests:** `movement-333` now uses computed layer constants. It adds the test "links ride directly on one another, no long bare pin at M or R", which checks every layer gap is in 0.005..0.03 and the M pin is just proud. The size.z floor went from 1.2 to 1.0.

## 328
- **Change:**
  - Piston rod B is a round rod (r 0.088) in the round 0.10 gland bore. It was a 0.105 × 0.15 box.
  - The cylinder bore is closed at the bottom by a flush end plug (r 0.199), which stops below the rod's lowest reach (−6.72 against the plug top at −6.80).
  - The 12-tooth input pinion is brass (PALETTE.brass), so it reads against the orange flywheel and the blue wheels C.
  - The crosshead boss was already round.
- **Captures:** `328-after.png` (default, below, pinion zoom), `328-after2.png` (gland zoom and the closed bottom).
- **Tests:** added a test to `movement-328` for the round rod, the flush plug and the brass pinion.

## 326
- **Change:** the crankshaft pillow block is one extrusion.
  - The outline is a round housing (r 1.75 s) concentric with the shaft, with straight tangent sides down to a flat foot (±2.1 s) on the crown.
  - It spans z = frameBack..0.31, so there is no overhang behind the frame. The separate block foot is gone (bearingSupports is now empty).
  - The bearing bush was resized to the new depth.
- **Not changed (forced):** the "tray" at the top of the standard stays. It is the crank pit, which is concentric with the shaft and 0.06 outside the crank's sweep, plus the transverse rod slot. The crank dips 0.50 below the top edge and sweeps nearly the full crown width, so the top cannot be closed flush.
- **Captures:** `326-after.png` (default, and three pillow-block zooms).
- **Tests:** added a test to `movement-326` for the one-piece block seated on the crown with no overhang behind.

## 327
- **Change:**
  - The piston rod is round (r 0.10) in the gland bore (r 0.115). It was a 0.157 × 0.15 square bar.
  - The connecting rod is Brown's broad strap: shank 0.22 (was 0.10), crank eye r 0.19 (was 0.143), slide eye r 0.16.
  - `makeConnectingRod` gained optional `shankWidth`, `wristEyeRadius` and `wristRingRadius` parameters. Their defaults reproduce 326's rod exactly.
- **Captures:** `327-after.png` (default, right, gland zoom, rod zoom).
- **Tests:**
  - `engine-guide-solids` now probes the round rod's true radius (the box half-diagonal overstated it) and asserts that the rod is a cylinder.
  - Added a test to `movement-327` for the shank width and the round rod.

## 330
- **Change:**
  - Guide A's bearing is one round-bored boss (r 0.25). A neck of the arm's section (±0.12 × ±0.14) runs into it.
  - The boss encloses the dark bush ring (outer r 0.22), which was poking out of the old 0.36-deep square block as black crescents.
  - The prolonged piston rod is round. Its radius is the old square's circumradius, so every bore keeps its 0.027 radial clearance and the `radialClearance` bookkeeping is unchanged.
  - The six flywheel arms are one shared `spokedWebGeometry` web (6 spokes, width 0.30, hub r = the old hub, rim fillet 0.08, embedded 0.05 in the rim bore), replacing six boxes butted against the rim.
- **Captures:** `330-after.png` (default, right), `330-after2.png` (guide from below-left, spoke/rim, hub).
- **Tests:** added a test to `movement-330` for the round rod, the boss containing the collar, and the one-piece web.

## Tests run
- 17 files, 120/120 pass: movement-326/327/328/330/332/333/336, engine-guide-solids, engines-326-345-clearance, marine-parallel-solids, marine-rotor-working-solids, piston-engine-solids, piston-guide-329-331-solids, piston-guide-solids, steam-engine-working-solids, steam-seams-p88-s and authored-loader.
- No saved validation report or MuJoCo bake fingerprints these four factories. The only match was docs/movement-status.json, which was not touched.
