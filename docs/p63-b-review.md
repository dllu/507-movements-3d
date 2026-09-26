# Pass 63 — lane b (221, 284, 291, 295/294, 309)

Captures are not in Git. They are in `/dev/shm/p63-b/`:

- `before/ID-default.png` and `after/ID-default.png`: the render beside the plate.
- `t284c.png` and `t284s.png`: the claw and the slider, before and after.
- `t291.png`: the stop d and the balance, before, after and the plate.
- `ph291.png`: 8 phases.
- `rot221.png` and `rot295.png`: default, ±60°, top and back views.
- `t309e.png`: the 309 nib experiment. It was reverted.

Intersection screens were run one at a time (`--spacing=0.01 --samples=129`).
`check-loop-seams --ids=221,284,291,294,295,309` found 0 seams.

## 221 — groove plate g–h (authored-elliptical-idler-gears.js)

- The groove is now cut into one solid elliptical plate behind C:
  - The floor fills the whole outer groove line, and the island inside the groove is solid.
  - The three spokes are gone. The plate hangs on the single post at the ellipse centre, which C hides.
  - The post now ends at the plate's mid-plane, so it no longer shares a coplanar back face with the plate.
- Default view: the groove band and the plate face show round C. No spokes or openings.
- Back view: one plain plate.
- Brown dashes the groove because it is hidden work. The plate edge coincides with his outer dashed line.
- Screen: clear before and after. Faces: clean.
- Contact report regenerated: results unchanged (0 penetrations); only the source hash changed.
- Test: no spokes, and the floor and island have no holes.

## 284 — saw-mill feed (authored-saw-feeds.js)

- Brown's ratchet tooth faces are not radial. Measured round the free half of the wheel (20 faces), each tip stands
  about 0.6° of wheel turn ahead of its root. That makes the face lean 10–13° back over its own tooth, 11.5° on
  average.
- The ratchet now uses a 12° face lean (`TOOTH_FACE_LEAN`).
- With that face:
  - The claw's working edge rises Brown's 16°, with no overlap on the tooth above over the whole feed.
  - The returning claw drops behind the next tip sooner.
- The least feed setting that feeds is now 3.5 px below Brown's slider:
  - 0–3 px ride without feeding, even with leans of 11–14°.
  - The slider now stands 4 px low, down from 9.
  - The overtravel is 0.028 pitch.
- Brown's drawn setting (0 px) cannot feed. It sweeps 1.16 teeth, and with the oblique approach of the claw about
  1.35 are needed. Reaching that would take a 14% longer crank (76 px against the drawn 66.7 px), which is outside
  the measurement.
- Screen: unchanged, contact level only (ratchet/click 0.0001, ratchet/catch 0.0000).
- Tests: the radial-face test is rewritten to require Brown's lean and the 16° claw edge. The drop limit is now
  4 px or less.

## 291 — Arnold detent (authored-plate-escapements.js)

- Stop d's bottom now sits on Brown's ink line, y = 215 (the old note said 213; his line spans 214–216.5). Before,
  it reached 218.
- Tips: Brown's ten unobstructed tips lie 119.5–125.8 px from his centre mark (145.5, 327). The tip radius is now
  121.7 px, their mean, instead of the minimum 119.5. A tip now locks on d's face at (188, 213), 2 px above d's
  bottom, which is his tip-at-corner pose.
- Balance: the larger tips would strike the plain edge of a 48 px roller about Brown's arbor mark (77, 186).
- A circle fit to Brown's roller outline gives centre (75, 182.5) and r = 48.5. His arbor mark is 4 px off that
  centre. The concentric roller and balance now stand at the roller's own centre.
- The passing-spring tip stays at Brown's (88, 185.4).
- Screen after:
  - hook-lip/spring 0.0087 and spring/spring 0.0024: intended contacts, as before.
  - wheel/roller 0.0001: impulse contact.
  - The stud–spring pair no longer registers, because the analytic lift keeps them touching.
- Phases: it locks, unlocks and drops as before.
- Faces: 4 degenerate triangles in the wheel cap. These are invisible.

## 295 (and 294) — cylinder (authored-plate-escapements.js)

- Two cylinders: Brown's caption says 295 "represents the different positions taken by cylinder A, B, during an
  oscillation". It is a multi-position figure of one cylinder, so one cylinder moving through those positions is
  the faithful 3-D form.
- The wheel's arms: the wheel is now:
  - a narrow rim whose chamfered inner edge (a 3 px chamfer) is Brown's arc at 325 px;
  - inside the rim, a plain solid web recessed 0.12 behind the rim face.
- The default view therefore shows the arc as an edge line and a blank face below it, with no arms or windows.
- The camera framing is unchanged.
- 294 removes the wheel rotor, so it is unchanged in view.
- Screens:
  - 295: lip–wedge 0.0001 (contact), unchanged.
  - 294: none.
- Faces: the chamfer ring touches the rim (same look), with no bad faces.
- The test for the open rim is rewritten. It now requires one round rim opening at 320–335 px and a web recessed
  behind the rim.

## 309 — Mudge gravity (no change; forced residual)

- Brown's B end:
  - His bottom edge runs level at y ≈ 206.5 from the corner (100.5, 204) to x ≈ 129.
  - It then falls to a nib tip at (145, 214.5), 15 px inside the tooth-tip circle, in the tooth space.
- The model locks the B tooth 5.6° further round than Brown (135° against his 129.4° about the wheel centre).
  Its lifting face is the traced path of the tooth tip, so it rises about 17° up-right.
- Tried: I added Brown's nib outline to the left pallet plate and re-baked. The swept-cut bake removed all of the
  nib, because the teeth sweep that region. Plate and bake were restored exactly (bake file identical to HEAD).
- Following Brown's outline needs a re-derived lock angle and lifting geometry for the whole 309 escapement, which
  is outside this pass.

## Tests

The following pass (41 in all):

- `movement-221`
- `variable-idler-solids`
- `movement-222`
- `movement-284`
- `plate-escapements`
- `movement-304`
- `source-presentation`
- `movement-309`
