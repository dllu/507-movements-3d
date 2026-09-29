# Pass 99 lane g: catches 181–184

User finding (2026-09-28): the catches of 181–184 still had messy geometry: slits, jogs, stray notches, parts that did not fit and asymmetry. Screenshot 114 showed the slit in 181's blue beak; screenshot 115 showed the steps at the tip of 184's see-through wing. The user also asked for the beam behind the orange tappet to be grey. All four plates have an orange tappet on an orange piston rod.

Captures are in `/dev/shm/p99/g/`:
- `sheet-{before,after}-<id>.png`: the plate, the default view at phases 0 and 0.5, and yaw ±40 and pitch ±25 at phase 0.25.
- `sheet-{before,after}-close-<id>.png`: close-ups of every catch edge.
- `sheet-after-seat.png`: the 181 and 182 latch seats at 10× zoom, straight on and rotated.
- `q-overlay2.png`, `a-181*.png`: outlines overlaid on the plates.

## 183 / 184: `quadrant-catch-finite-parts.js`, `authored-quadrant-catches.js`

An outline linter reports every vertex that turns by more than 8°. It found about 30 steps, jogs and kinks in the old parts.

**Lower quadrant (plane F)**
- Rebuilt so it is exactly symmetric about its centre line (−91.15°). Brown's two band-end angles differ by only 0.3° about that line, which is within his drawing accuracy.
- The band runs between r = 134.5 and r = 111 about the shaft.
- Each end is one straight cut. It keeps Brown's lean: 40.3° at the rim and 45.1° at the inner rim. The cut runs straight on to r = 103.5, where one concave arc takes the flank to the boss.
- The step-like "lips" that 183 draws under each end are gone. Plate 184 draws the same casting without them, and they have no function.
- The window is symmetric: the inner-rim arc, two concave arcs and a straight foot.
- The web stops 1 px inside the boss, so no bore wall is coincident with the boss's.

**Upper wing**
- One straight edge runs from the boss to the rim and meets it at a 98° corner. This removes 183's tab, including its 11–24 px jogs, and 184's radial "tip cut" steps. 184 now uses 183's casting unchanged, as squared off as Brown draws it.
- The lower edge is one convex arc from the boss to the toe. It replaces an arc plus a straight segment that had a 15° kink and a jog 1.4 px outside the boss.
- The toe stays cut to the band's rim (r = 134.9 about the lower shaft), which is the functional seat.
- The window is symmetric about 10.4°: the concentric arc, two concave arcs and a concave flank.

**C-arm hook**
- Both spline edges now meet the round hook on their true tangent points. The old joins had 17–23° kinks.

**Ball lever**
- Both edges now run into the hub, so no end face shows at the boss.

**Motion**
- Rebaked with `scripts/bake-quadrant-catch.mjs`. The motion is effectively unchanged: the release is at row 252 with the lower handle at 62°, and the hold is 60.0° (59.9° before).
- The linter now reports only intended corners: rim/end-cut, window corners, the wing tip and toe, and joins buried in the boss.

**Colour:** the piston rod is `PALETTE.muted` steel grey; the tappet is `PALETTE.driver` orange. It was dark red before.

## 181 / 182: `mujoco-diagonal-catch/{assembly,catch-profile}.js`, `authored-diagonal-catches.js`

**Horn and beak castings**
- The old castings were carved against the catch's sweep over the product of both joints' full ranges. That left staircase steps, a V notch on the horn and the thin slit in the beak (screenshot 114).
- Each is now one clean outline:
  - Horn: the tangent hull of the qualified catching face and the boss.
  - Beak: Brown's crescent. It is the hull of the face and the shaft, with one circular outer arc tangent to the face's working edge down to the boss, squared off along the line of the heel's end face.
- Checked against the catch through the new 9001-key motion: overlap area is 0 away from the faces, and clearance is at least 0.017 (horn) and 0.022 (beak).

**Catch**
- The three Bézier joins that kinked by 14–17° now join tangentially, and the outline is sampled 3× finer (the 13° facets are gone).
- The lower end had a hook pocket. In the simulated latch the beak's end seats under the lowest point of the lip and never enters the pocket; its entry path along the arm's inner edge cannot reach it. The pocket was a non-functional notch, so it is filled: the lip's underside continues tangentially as one fillet into the eye.

**Working arms:** they now narrow to the tip radius (end half-width 0.12 → 0.10). This removes the 1.6 px step where the arm met its round tip.

**Motion**
- Re-simulated with `scripts/project-diagonal-catch-motion.mjs` (MuJoCo plus projection). All controls pass.
- The largest change from the old motion is 0.015, 0.040, 0.009 and 0.002 rad/units on the four joints. The hold poses are unchanged at the joint limits −0.995 and −0.944.
- Rebaked with `scripts/bake-diagonal-catch.mjs`.

**Seats**
- 181: the upper face's edge lies flush along the catch's ledge.
- 182: the lip's lowest point rests on the beak's end. The end is flush with the lip to within 0.2 px over 4.6 px.

**Colour:** the piston rod is `#7e8584` grey; the tappet is `#de5a3f` orange. It was `#c9563d` before.

## Validation
- Regenerated: `181-projected-contact-motion.json`, `181-bake.json`, `181-baked-assembly-clearance.json` (129 poses, no intersections), `181-source-head.json`, `181-tappet-study.json`, `181-transfer-study.json` (controls unchanged) and `181-current-solids.json` (129 poses). All their provenance hashes match the current files.
- `181-current-solids.json` still lists the 6 known intersections of the legacy scaffold's unshown rollers, as it did before this pass. Its script's assertion also still fails because of them.
- `183-current-solids.json` (65 poses): worst penetration 0.00008.
- Tests: `node --test` over `quadrant-catch-finite-interfaces`, `movement-179…184`, `diagonal-catch-baked`, `diagonal-catch-assembly`, `mujoco-baked-loops` and `authored-loader` passed 143/143. The `models.test.mjs` blocks "all 507 movement records…" and "selector mechanisms…" pass.
- Screens:
  - Coincident faces: 0 flagged for 181–184. My first 183/184 quadrant introduced a bore-wall coincidence; it was fixed.
  - Disconnected parts: only transient moving near-misses between separately moving bodies. 183 keeps its one existing C-arm/boss lip flag, which is unchanged from before (0.8% of the part's size).
