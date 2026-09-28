# Pass 94, lane p94-a: clearing minor rows 109, 247, 303, 321, 326, 331, 332, 342, 355, 366

- **Reviewer:** Claude Opus 5.5, lane p94-a. Four forks worked on disjoint files: A1 (109), A2 (247, 303, 321), A3 (326, 331, 332) and A4 (342, 355, 366). The lane integrated their results. Date: 2026-09-28.
- **Claims:** all files are in /dev/shm/p94/claims with owner p94-a. The claimed shared helpers are `release-mechanism-working-parts.js` (278 hash unchanged), `gyroscope-working-parts.js` (356 hash unchanged), `graham-303-anchor.js` and `mujoco-baked-routes.js` (only the 109 entry changed).
- **Captures:** before captures are in `/dev/shm/p94/a/before/` (`sheet-ID.png` shows the plate, phases 0/0.25/0.5/0.75 and a rotated view). After captures are in `/dev/shm/p94/a/<id>/` and `/dev/shm/p94/a/A2after/`.
- **Git:** none.

## 109: seamless loop (fork A1)

**Flaw.** At the top reversal the fully cut screw was swapped for a fresh blank, which showed as a visible pop. `before/sheet-109.png` shows it: phase 0.5 is threaded, and phase 0.75 is suddenly plain.

**Why the job can't loop as-is.** A rigid tool that removes material from a finite blank can't return to the blank without an exchange. I looked at a bar-feed exit, where the finished screw leaves through the rails and a blank enters. It would need the work bar to run through both rails and the gear. It would also need a clutch, because the gear-driven spindle turns while the bar slides, so the tool would cut rings. Neither part is on the plate, so I rejected it.

**Fix: re-cut continuously.** Playback opens part-way down the first cut, in Brown's state: threaded above the tool and the plain blank below. That descent finishes the thread. The tool then runs back up its groove, and on every later pass it re-cuts (chases) the finished thread. The work is never exchanged, and stock is only ever removed, so nothing pops at a reversal or at the loop seam. The only way back to the part-cut state is a reset.
- `profile.js`: `cutWorkAngle(time, workAngle, since)` uses the progressive cut until `firstCutEnd(since)`, the bottom reversal after playback starts. After that it holds the finished cut. The stroke schedule and MuJoCo XML are unchanged.
- `geometry.js`: `syncCut(time, workAngle, period, since = 0)`. The live sync (`visual.js`) uses `since = 0`, and the updated `reconstructionNote` describes the new behaviour.
- `baked/mujoco-baked-routes.js`, 109 entry only (claimed; the other entries are byte-identical): it passes `since = loop.startTime`.
- `scripts/lib/mujoco-bake-configs.mjs` 109 entry: new note, plus `roundTripLoops: 1`.
- `scripts/bake-mujoco-movement.mjs`: new optional `roundTripLoops`, defaulting to 0 so other movements are unchanged. It compares the live model at the loop start time, where the thread is long finished, with the second baked loop.
- **Rebake:** `node scripts/bake-mujoco-movement.mjs 109` still gives 1500 samples over one 24 s period from 48 s. Raw seam 0 px, seam step 4.489 px (interior 4.503), round trip 0.0065 px. The provenance was rewritten with new source hashes.

**Captures** (`/dev/shm/p94/a/109/`):
- `sheet.png`: the plate plus phases 0, 0.2, 0.24, 0.25, 0.5, 0.74, 0.75, 0.76, 0.99, 1.0, 1.01, 1.25, 1.75 and 2.0, and three rotated views.
- Phase 0 matches the plate. From 0.24 on the thread is complete and stays so through the top reversal (0.74–0.76) and across the loop seam (0.99–1.01).

**Tests.**
- `tests/mujoco-thread-cutting.test.mjs` 5/5. Test 5 is rewritten. Over two loops, live and baked:
  - baked and live volumes agree;
  - volume never increases, so there is no fresh blank;
  - on the opening descent the groove never runs below the tool, and the job opens part-cut;
  - after the first bottom reversal the volume equals the finished thread and stays constant;
  - the baked seam at 3× the duration is continuous.
- `mujoco-baked-loops` 116/116. `models.test` movement 109 and `mujoco-runtime` pass.

**Screens.**
- `check-loop-seams`: skips MuJoCo movements, so 0 were checked.
- Disconnected parts: 0 detached, the same 2 near-misses and 1 lip as the baseline.
- Coincident faces: 0.
- Body intersections: worst 0.0879, the same hidden keyway against the nut as before.

**Proposed ledger row.**
- **assessment:** reasonable
- **visibleFlaws:** empty
- **limits (replace the p93 sentence "the work screw is threaded only down to the cutter, blank below; the tool runs back up its own groove" with):** "p94: playback opens part-way down the first cut (threaded above the tool, plain blank below, as drawn); that descent finishes the thread and later passes chase it, so the work is never exchanged and the loop has no jump; a reset returns to the part-cut opening." Keep the 52:76 pitch sentence.

**Files:**
- `src/simulation/mujoco-thread-cutting/{profile,geometry,visual}.js`
- `src/simulation/baked/mujoco-baked-routes.js` (109 entry; claimed)
- `src/simulation/baked/assets/mujoco-109.{json.gz,provenance.json}`
- `scripts/lib/mujoco-bake-configs.mjs`, `scripts/bake-mujoco-movement.mjs`
- `tests/mujoco-thread-cutting.test.mjs`

# p94-a fork A2: 247, 303, 321

Scratch and captures: /dev/shm/p94/a/{247,303,321}/, plus the plate sheets in /dev/shm/p94/a/A2after/sheet-{247,303,321}.png. The before sheets are in /dev/shm/p94/a/before/. No git writes.

## Files changed
- src/simulation/authored-sounding-weights.js (247)
- src/simulation/release-mechanism-working-parts.js (247's finite-seat wrapper only; claimed). 278's `finishOtis278Parts` is untouched: the 278 geometry and pose hash is 26951f8130a88bb4 both before and after.
- scripts/generate-graham-303-anchor.mjs and the regenerated src/simulation/baked/graham-303-anchor.js (303; claimed). inputHash is now ccb172f00490c8a5.
- src/simulation/authored-going-barrels.js (321; serves only 321)
- tests/movement-247.test.mjs, tests/movement-303.test.mjs, tests/movement-321.test.mjs

## 247: the rod leaves the view during the reset (fixed)
- **Verdict:** real. The rod used to be hauled to y 24 and re-armed far above the view. It had to go that high because the fresh weight was threaded on over the probe foot from below.
- **New reset device:** the rod stays in view throughout.
  - After the trip, the rod is lifted only until its foot clears the spent weight by 0.25 (clearBodyY 4.75, against 24 before). The catch rubs up the bore and snaps out over the rim, as before.
  - The vessel then moves on, and the bottom carries the spent weight off sideways.
  - The fresh bored weight is let go on the sounding line from y 14.5, which is above the 3×-zoomed-out view. It runs down the line under the model's own gravity (the same g as the release fall), passes over the rod's top and down the rod, and lands on the sprung-out catch nose, which is its seat. The finite-seat wrapper shifts the run progressively so that it ends exactly on the finite seat. The weight then rides on the rod as the rod is lowered back into Brown's pose.
  - The spare weight's route is out of every view. It is lifted at the previous station (x ±40), carried above the line's top end (y 65) and let down over that end onto the line.
- **Hand removed:** the leadsman's hand is gone (it was an undrawn part flagged low). The line now runs straight up to y 60, far above any view.
- **Timeline:** freshWeightReleased 5.6, rodRecovered 6.9, weightSeated 8.28, descent 8.6–10.2. The loop is still two soundings (22.8 s) and closes seamlessly.
- **Captures:**
  - 247/b-strip.png (before: the rod is absent at phases 0.8 and 0.85)
  - 247/a-strip.png (after, reset beats 5.0–11.0 s, with rotated views at 7.0 and 8.15 s)
  - A2after/sheet-247.png
- **Tests:** movement-247 passes 11/11. The old re-arm test is replaced by a p94 test: the rod is lifted only to clear; the catch is out before the weight arrives; the weight lands on the finite seat; the rod never leaves the default view (`rod.min.y < fit.max.y - 1.5` at 4000 samples); no pops and no weight in the bottom. The rate-check samples at 6.3 and 6.9 moved to 6.7 and 7.4, off the new stage boundary and the numeric weight-limited catch.
- **Screens:**
  - Intersections: worst solid 0.0000.
  - Coincident faces: 2 pairs, area 4e-6. The baseline had 3 pre-existing pairs.
  - Disconnected parts: floating went from 1 to 0 (the old parked weight), detached stays at 2 near-miss, and near-misses went from 34 to 36. The new near-misses are probe and guide sliding pairs whose sampled relation changed.
  - Seams: 0.
- **Ledger:** assessment reasonable; visibleFlaws "". Replace the loop sentences in limits with: "p94: between soundings the rod is lifted on its line just clear of the spent weight and stays in view; the fresh bored weight, threaded on the line far above any view, runs down the line and the rod onto the sprung catch nose, and the re-armed rod is lowered back into Brown's pose as the vessel moves on (bottom and spent weight move off sideways). The weight's route from the previous station to the line's top is unmodelled and out of view. The leadsman's hand is removed; the line runs straight up out of view."
- **Deferred (file owned by p94-b):** the 247 note in src/data/source-presentation.js still describes the old reset. Suggested replacement for its second sentence onward: "The loaded rod is lowered onto the bottom, the probe trips the catch and the weight drops; the rod is lifted on its line just clear of the spent weight, and the second of two alternating weights, let go on the line far above, runs down the line and the rod onto the catch; as the rod returns into Brown's pose the vessel moves on to the next station, the bottom and the spent weight moving off sideways together. The loop is two soundings long; no reload gear is shown."

## 303: pallet E's tip facet (fixed; D treated too)
- **Verdict:** real. Past the impulse face's exit, E's baked outline (the blank minus the swept tooth envelope) had a small hooked tip, then a spike, then a stepped notch cut by the next tooth. D had a hook, a bump and a notch at its tip, and a 0.004 nick and a short ledge where its lock face met the arm.
- **Fix, in the generator:** a new `trimEnds` step after the envelope cut.
  - **Impulse exit:** the tip is trimmed along the chord that reaches furthest toward the back (at most 0.36), starting up to 0.025 back along the face. Every skipped vertex must lie outside the pallet, so this only removes material. E drops 214 vertices, and its back is now one straight edge to the outer corner. D drops 43.
  - **Lock entry:** the same rule, with a 0.2 limit and a 0.005 fill allowance. Where the face, run on straight, meets the arm edge beyond a proud corner, the face ends there. D's lock face now runs straight into the arm edge. E only loses a 2-vertex bump.
- **Tests:**
  - Working-solids: the tooth tip still stays outside the faces, with the working gap inside 0.005–0.035, and there is 0 penetration at 97 poses.
  - movement-303 and graham-303-working-solids pass 14/14. A new p94 test checks that both tips leave the impulse face on a single edge longer than 0.3, with the trim recorded.
- **Captures:**
  - 303/b-sheet.png (before zooms)
  - 303/a-sheet.png (after: zooms at phases 0, 0.25 and 0.5, rotated zooms, D zooms, default and rotated)
  - 303/c-LR.png (face-on and oblique close-ups of D and E, wheel hidden)
  - 303/zoomLR.png (outline plots)
- **Screens:**
  - Intersections: 0.0000.
  - Coincident faces: 0.
  - Disconnected parts: 1 detached (pre-existing), 0 near-misses, 0 slivers, 0 lips.
  - Seams: 0.
- **Ledger:** assessment reasonable; visibleFlaws "". Append to limits: "p94: the pallet ends are trimmed after the envelope cut (removal only; D's 0.004 lock-entry nick filled): each impulse face leaves its tip on one straight back edge, and D's lock face runs straight into its arm."

## 321: the spring's bottom loop is a tight bend (fixed)
- **Verdict:** real. The polar tanh/hairpin law turned the wire at radius 0.0065 (0.049 at test sampling).
- **Fix:** the wire's reference shape is now Brown's centre line.
  - It is 13 points read off the plate, joined by a centripetal Catmull-Rom curve between the unchanged S′ and S anchors. The curve is resampled by arc length and held in polar form about the arbor.
  - As G runs ahead during winding, the angles spread in proportion to the anchors' sweep, and the existing fixed-length solve opens the U toward the chord. The material length is now 3.7356 (was 3.640).
  - At the plate pose the U has radius 0.21. The tightest bend over the whole cycle is 0.185, where it was 0.049.
  - The overlay on the plate is 321/overlay2.png.
- **Removed constants:** springHairpinExponent, springReferenceDepth and springBendAmplitude. springSourceCentreLine is exported in their place.
- **Tests:**
  - movement-321, maintaining-clock-bake and maintaining-clock-interfaces pass 18/18. The click bake signatures are unaffected, so no rebake was needed.
  - A new p94 test requires the tightest wire bend to exceed 0.15 at 65 phases.
- **Captures:**
  - 321/b-z.png (before zooms at phases 0, 0.5 and 0.85)
  - 321/a-z.png (after)
  - A2after/sheet-321.png
- **Screens:**
  - Intersections: worst solid 0.0000, with 0.0011 coaxial.
  - Coincident faces: 0.
  - Disconnected parts: 0 detached, 16 near-misses (as at p93), 0 slivers, 0 lips.
  - Seams: 0.
- **Ledger:** assessment reasonable; visibleFlaws "". The current row lists only the loop; p93 also mentioned the S′ arm on a post through the ratchet's slot, which is still there and was already accepted. Append to limits: "p94: the wire follows Brown's centre line (smooth curve through 13 plate points), a round U of radius 0.21 at the plate pose; the tightest bend over the cycle is 0.185."

## Deferred
- The 247 note in source-presentation.js, owned by p94-b (text above).

# p94-a fork A3: 326, 331, 332

Files: authored-steam-engine-guides.js, authored-slotted-crosshead-engines.js, authored-marine-parallel-motions.js; tests movement-326/331/332. No shared helper edited; no validation report or bake fingerprints these files. display-profiles is unaffected (motion bounds set by the flywheel rims and vessel).
Geometry+pose hashes (hash.mjs, 16 poses): 327 08bb2591…, 329 9bce5bca…, 330 0c1a7b34…, 333 2063f4f1…, 336 c47fb631… are unchanged. Changed: 326 874ef85f→b6c7584a, 331 421c0c16→f755b9a7, 332 086dfd7e→9ec7112d.

## 326
- **Fix.** The flat cap, which sat 0.56 down inside the walls, is replaced by one extrusion flush with the standard's top edge. It is cut by a crank pit whose floor is an arc concentric with the shaft (radius 1.054, 0.06 outside the crank's 0.994 sweep). The narrow rod slot in front stays open. Raised views now show a crank-clearance pit that follows the crank, not a flat tray. The pit is forced: the crank dips 0.50 below the crown, and its half-chord at the top edge is 0.93 of the crown's 0.97 inner half-width, so no flush cap can close it. Brown's plate also shows the pin dipping below the crown.
- **Foot.** Kept. The piston rod shows through the window below A, as Brown draws. It must hide 1.76 of stroke below the window's bottom (−5.10), so it reaches −6.87, while the base line is −6.08. The foot bottom is at −6.94, 0.86 below the base line. Brown crops the base at the plate edge, so its depth is not bounded by the plate.
- **Test.** movement-326 now asserts that the cap is flush with the skin top, that the pit radius is 0.9–1.1, and that the crank arm and pin stay at least 0.05 inside the pit radius at 64 phases.
- **Captures.** 326/after-sheet.png (plate, default, p0.25, oblique top, p0.5 top, low foot), 326/a-sheet.png vs 326/b-sheet.png (after/before).

## 331
- **Fix.** The flywheel is two-armed, with only the horizontal pair, as Brown draws. The opening between the crossbeam and A is empty in the plate. The roles are now `flywheel-rigid-arm-N-of-2` and the rotor role is two-armed.
- **Tests.** The spoke counts in movement-331 and in movement-332's cross-check go from 4 to 2.
- **Captures.** 331/a-sheet.png (plate, p0, p0.25, p0.6, rotated, back).
- **Residual.** The arms are plain bars; Brown flares them into the rim with fillets. The shared spoked-wheel builder needs 3 or more spokes.

## 332
- **Fix.** The slim 0.5s arm is gone. Crosshead E is now one extrusion of Brown's capped end outline, running transversely from the link plane back to the piston rod on the vessel axis (z −0.535…0.29). This is a side-lever engine's crosshead, which Brown draws end-on. In the default view its end face is the drawn E block. In rotated views it reads as one crosshead beam, not an arm.
- **Captures.** 332/a-sheet.png (plate, p0, p0.5, rotated, side zoom, oblique zoom).

## Screens (326, 331, 332)
- **Seams:** 0.
- **Disconnected parts:** 0 detached, 0 slivers, 0 lips. Near-misses are 42 / 21 / 4; 331's dropped from 27 because two spokes are gone.
- **Coincident faces:** 0 / 1 (the existing 1.7e-5 pair) / 0.
- **Body intersections:** worst solid 0.0000 for all three.

## Tests
movement-326, 327, 329, 330, 331, 332, 333 and 336, engine-guide-solids, engines-326-345-clearance, marine-parallel-solids and piston-guide-329-331-solids: 87/87 pass.

## Proposed ledger
- **326.** Assessment: reasonable. visibleFlaws: "". Replace the p93 clause in limits with: "p94: the cap is flush with the crown and cut by a crank pit concentric with the shaft (the crank dips 0.50 below the crown, so a pit is forced), with the rod slot in front; the round rod runs inside the standard into a bored foot whose bottom is 0.86 below the base line, to hide the rod end over the 1.76 stroke (Brown crops the base); rear bridge removed."
- **331.** Assessment: reasonable. visibleFlaws: "". Append to limits: "p94: the flywheel is two-armed (horizontal pair only, as drawn); the arms are plain bars without Brown's rim flares."
- **332.** Assessment: reasonable. visibleFlaws: "". Replace the p90 clause with: "p94: crosshead E is one transverse extrusion of Brown's capped end outline, running from the link plane back to the inferred piston rod on the vessel axis (drawn end-on)."

## Deferred
None.

# Fork A4 (lane p94-a): 342, 355, 366

Files edited (all claimed by p94-a):
- src/simulation/authored-treadle-drills.js (366 only)
- src/simulation/authored-atmospheric-beam-engines.js (342 only)
- src/simulation/gyroscope-working-parts.js (newly claimed; 355 branch only)
- tests/movement-342.test.mjs, tests/movement-355.test.mjs, tests/movement-366.test.mjs (one new test each)

authored-gyroscopes.js was not changed. 356 is byte-identical (geometry, pose and camera hash b8bc8d105acf113a before and after). No saved report or bake fingerprints these files (checked with grep). plate-chain-links.js is not edited, so 334 is unchanged.

Originals are in /dev/shm/p94/a/orig/. Captures are in /dev/shm/p94/a/{342,355,366}/, and screen outputs are in /dev/shm/p94/a/A4scr/.

## 366: long crank shaft, plain-cone drill
- **Check against the plate.** Brown's frame column is at plate x 290–305 against the drill axis at 213 (105.8 px/unit), so it sits 0.73–0.87 from the axis. The crank stands at x 350 (1.30), and the handle reaches x ≈ 400. The model had the column at 1.52, the crank at 2.42 and the handle ending at 2.96. The bit is a flat spear-point drill: a tapering blade, a waist, and a diamond head with a point.
- **Crank and frame.**
  - The frame column moved from 1.52 to 0.84, leaving 0.21 clearance to the large bevel's back at 0.52. The input bearing and its bridge moved with it, to 0.80.
  - The crank is now at x 1.12 with radius 0.85 (was 0.60; Brown draws about 1.0), and the handle ends at 1.66.
  - The shaft ends 0.02 inside the arm. A flush end had added a coincident-face pair; that pair is gone again.
- **Drill bit.** The 8-sided cone is replaced by one flat 0.07 extrusion:
  - a 0.16-wide blade leaving the chuck;
  - a smooth concave taper to a 0.084 waist;
  - a sine flare to a 0.184 diamond shoulder;
  - straight edges to the point, which stays at the same tip height (−0.71).
- **Captures:** `366/sheet-after.png`, `366/sheet-final.png` (plate, 4 phases, 2 rotated views), `366/bitsheet.png` (plate bit crop beside the model), `366/after-crankzoom.png`.
- **Screens:**
  - Seams: 0.
  - Intersections: worst solid 0.
  - Coincident faces: the same 3 pre-existing pairs (lever/boss ×2, gear body/hub).
  - Disconnected parts: 1 detached as before; near-miss pairs 122 → 121 (short-of-pin 12 → 8).
  - Lips: 4 → 5. The added entry is the lower shaft-guide bridge, which is unchanged geometry (the same 0.0246 lip as the upper-guide bridge). It is a listing difference, not a new part.
- **Tests:** movement-366 and drill-feed-solids pass. A new pass-94 test asserts the shaft overhang is under 0.7, the handle ends before 1.8, and the bit is a flat non-cone blade with the tip at −0.71.
- **Proposed ledger:**
  - assessment: reasonable
  - visibleFlaws: empty
  - limits, append: "p94: the frame column (0.84) and crank (1.12, radius 0.85) stand where Brown draws them; the bit is a flat spear-point blade (one extrusion) in place of the cone."

## 355: framing
- **Check against the plate.** The plate is filled by the phase-0 pose: the pillar sits at the left fifth and the ring and disk at the right.
- **Change.** `cameraFitBounds` is now the phase-0 pose, (−1.3, −2.4, −2.2) to (4.25, 3.5, 0.0), with its depth trimmed so the receding spindle does not inflate the fit. `cameraDistanceScale` changed from .64 to .55. `sweptBounds` is kept, and `cameraFramingScope` is updated.
- **Result.**
  - Phase 0 is centred and fills the view like the plate.
  - In the app's wide viewport (1400×800) the whole precession sweep stays in frame (`355/sheet-w.png`).
  - In a square viewport, between about phases 0.4 and 0.6 the disk and ring run up to half off the left edge.
- **Captures:** `355/sheet-final.png`, `355/sheet-w.png`, `355/sheet-a.png`.
- **Screens:** seams 0, intersections 0, coincident 0, disconnected unchanged (0 detached).
- **Tests:** movement-355, gyroscope-working-interfaces and camera-catalog (all 507) pass. A new test asserts the fit box is centred on the phase-0 pose and narrower than 6.
- **Proposed ledger:**
  - assessment: reasonable
  - visibleFlaws: empty
  - limits, replace the p90/p93 tail with an appended: "p94: the opening view frames Brown's phase-0 pose; in square or narrow viewports the ring passes partly beyond the left edge mid-sweep (the full sweep fits wide viewports)."

## 342: faint slot panel; chain hidden in rotated views
- **Slot panel.** It now stands 0.025 proud (was 0.02). A taller panel would meet the stay eye at z 0.53. It is also in a darker tone of the beam blue (×0.45), so it reads clearly in the default view as Brown's slot band (`342/sheet-d.png`).
- **Chain.**
  - `chainLineZ` moved from 0.30 to 0.43. The front side plates (up to z 0.525) now stand 0.025 proud of the head's 0.50 face, so the wrapped chain stays visible from strongly rotated front views: yaw ±60 and ±75 in `342/sheet-c.png`.
  - The rear plates still ride the 11.7 rim.
  - The piston, crosshead, rod, cylinder and head lug follow the same line. The lug stays inside the head's depth.
- **Residual.** The chain line is 0.13 in front of the beam's mid-plane. From behind, the head still hides the chain, which is natural occlusion.
- **Captures:** `342/sheet-c.png` (rotated views), `342/sheet-d.png` (plate plus default at phases 0 and 0.5), `342/c-zoom-slot.png`, `342/sheet-final.png`.
- **Screens:** seams 0, intersections 0, coincident 0, disconnected unchanged (1 detached, 22 near-miss, 0 lips).
- **Tests:** movement-342 passes 9/9. The new test asserts the front plates stand more than 0.02 proud of the head face, the rear plates are within the head depth, and the panel is darker than the head.
- **Proposed ledger:**
  - assessment: reasonable
  - visibleFlaws: empty
  - limits, append: "p94: the chain line is 0.13 in front of the beam's mid-plane so its front plates stand 0.025 proud of the head face (visible in rotated views); piston and cylinder follow it; the slot panel is a darker 0.025 emboss."

## Deferred
None.

