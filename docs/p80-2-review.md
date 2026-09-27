# Pass 80, lane p80-2: confirmed disconnections in 283, 285, 295, 309, 331, 339, 340, 368, 373, 397 and 398

Source: `/dev/shm/p79-triage/confirmed.json`. Captures are in `/dev/shm/p80-2/`, outside Git:
- `before/` and `after/`: `ID-default.png` and `ID-oblique.png` from `scripts/review-movement-source-views.mjs`.
- `c*.png`: close views at several phases and directions (`closeup.mjs`).
- `before.json`, `after.json` and `after2.json`: output of `scripts/screen-disconnected-parts.mjs`.

None of the changed movements has a MuJoCo bake. 309 is unchanged, so `baked/gravity-escapement-plates.js` was not
rebaked, and 310–312 are untouched.

| ID | Confirmed gap | Screen after | Change |
| --- | --- | --- | --- |
| 283 | handle, grip and boss 0.26 in front of the pinion | 0 detached | `authored-rack-pumps.js` |
| 285 | centre shank ends in the open quill mouth, 0.085 | 0 detached | `authored-lathe-heads.js` |
| 295 | escape-wheel arbor floats 1.14 in front of the web | 0 detached | `authored-plate-escapements.js` (294/295 model) |
| 309 | fixed suspension stud end touches nothing, 0.029 | unchanged | none (see below) |
| 331 | crossbeam and pediment 0.144 above the pillar tops | 0 detached | `authored-slotted-crosshead-engines.js` |
| 339 | rod eyes loose on pins C and F, 0.03–0.035 | 0 detached | `authored-direct-action-parallel-motions.js` (339 function) |
| 340 | radius-bar eye loose on pin A, 0.052 | 0 detached | same file (340 function) |
| 368 | rack top drops out of the upper guide, 0.065 | 0 detached | `authored-cylinder-spiral-scribers.js` |
| 373 | driving-shaft stub loose in the pulley hub, 0.056 | 0 detached | `authored-rolling-friction-experiments.js` |
| 397 | shuttle bar 0.30 from the link pin, with no lug | 0 detached | `authored-intermittent-shuttle-drives.js` |
| 398 | crosshead rails stop 0.076 short of the roller | 0 detached | `authored-cam-rocking-drives.js` |

## 283: handle not on the pinion

**Cause.** The handle, boss and grip are children of the pinion rotor, whose group stands at z 0.28. However, they were
placed at world z values, so the whole handle stood 0.28 too far forward.

**Change.** The parts now sit in the rotor frame:
- The boss seats on the pinion's front face, at world z 0.50 to 0.72.
- The bar runs at world z 0.62, and the grip at 0.52 to 1.06.
- Both clear the guide fronts (world z 0.51) as the handle sweeps.
- The boss is deep enough to bury the tube's open end.

**Evidence.** `c283.png`: side, top and back views at six phases. The boss is flush on the pinion face.

## 285: lathe centre not seated

The quill carries a short plug (r 0.265) that fills its bore at the nose. The centre's shank ends in the plug.

The plug is 0.07 deep. When the quill is fully withdrawn (nose x −1.890), the plug still stops 0.018 short of the fixed
screw end (x −1.802).

**Evidence.** `c285.png`.

## 295: escape-wheel arbor

The arbor now runs through the recessed web's own bore (r 10 s), from 0.12 behind the web to 0.12 in front of it.
Before, it stood at z −0.3 to 0.2. The wheel centre lies outside 295's plate view, and 294 removes the arbor, so neither
view changes.

**Evidence.** `c295.png`.

## 309: suspension stud (no change)

The stud is Brown's small circle above the two arbors C, which he draws standing apart. It is a fixed stud whose clock
frame is not drawn, like the pallet arbors themselves.

The only ways to "carry" it would be:
- adding an undrawn frame, which the rules forbid;
- moving the pendulum centre, which changes the baked escapement.

Under the brief's rule, a small drawn fixed part that ends on nothing is acceptable. The 0.029 clearance to the eyes is
less than Brown's gap. Brown's stud stands about 0.21 above the arbor line, and the model's stands 0.15 above it.

## 331: pillar tops

The pillars D now rise to the underside of the crossbeam (source y 7). The official animation's guide limit,
`crossheadGuideTopY` 6.4, is kept as the crosshead travel limit and in its test.

**Evidence.** `after/331-default.png`: the beam sits on the pillars.

## 339 and 340: loose rod eyes

The `makeBoredLinkRod` default bore (width × 0.85 + 0.004) gave 0.03–0.05 of play. Each eye is now bored to its own pin:

- **Pins the eye turns on:** pin radius + 0.004.
  - In 339: connecting rod P-C, bar B-C (B, C and the midpoint eye A), and radius bar F-A at F.
  - In 340: radius bar E-A at E and A.
- **Pin A in 339:** rigid with its radius bar, so that eye is bored to pin + 0.0015.

**Evidence.** `c339-340.png`: every pin is flush in its eye.

## 368: rack out of its upper guide

The rack is two whole pitches longer at the top: length 4.06 + 7 pitches, up from 4.06 + 5. At the bottom of the stroke,
its top is now at y 4.19, above the guide's top at 4.025.

The teeth are laid out from the unchanged bottom end, so the pinion phase and the marking point do not change. The extra
length is beyond Brown's break at the top of the plate. The see-through rack style is unchanged.

`docs/validation/368-372-contact-solids.json` was regenerated with `POSES=33`. It shows no penetrations and the same gaps.

**Evidence.** `c368.png`: bottom-of-stroke front and oblique views.

## 373: driving-shaft stub

The stub's radius goes from 0.06 to 0.114, which fills the remote pulley's hub bore (0.116). This closes the p76
residual.

## 397: shuttle bar lug

The bar now carries Brown's lug under its left end, as one plate in the bar's plane:
- a round eye on the link pin (r 0.24);
- a neck that leans up to the right into the bar's underside.

Other changes:
- The link pin is fast in the lug.
- The pin grows from r 0.14 to 0.15, matching the top-joint pin. The link eye's 0.154 bore now has the 0.004 running
  clearance, so the crescent is gone.
- The lug is 0.001 thinner than the bar, so there are no coplanar faces.

**Evidence.** `after/397-default.png` matches Brown's hanging lug, and `c397.png` shows it at four phases and
directions. Between the lug (world z 0.46) and the link (0.75), about 0.29 of the pin shows, because the link's plane is
set by the rocker.

## 398: roller carried by the crosshead

The crosshead now has an eye round the roller's upper end, at z 0.471–0.629, above the cam land (0.30). The rails run
into it from x 0.17, where they used to start at 0.228. This matches the rod eye at the roller in Brown's plate.

**Evidence.** `after/398-default.png` and `c398.png`.

## Intersections and faces

`show-body-intersections.mjs` was run on every changed ID, at 0.01 spacing with 129 samples:
- **283, 285, 339, 340, 368, 373, 397 and 398:** no pairs.
- **295:** one working contact of 0.0001 (C-passage against wedge head).
- **331:** `lower-engine-crossbase-from-official-model` overlaps the flywheel rim and spokes (0.098–0.12). This was
  already in the ledger (pass 49) and does not involve the pillars. It is left as a residual.

`scan-bad-faces.mjs`: the only new entries are same-look coplanar faces where the new eye or lug meets the rails or bar.
Both were then inset by 0.001. The existing 285 grip degeneracy and 331 pediment mixed edges are unchanged.

## Tests

`node --test` was run on:
- movement-283, 285, 309, 331, 339, 340, 368, 373, 397 and 398;
- plate-escapements, piston-guide-329-331-solids, clamp-tailstock-solids, groove-drive-working-solids,
  roller-working-solids, scriber-dynamometer-solids, rack-output-solids, vibrating-direct-action-solids,
  engines-326-345-clearance, opposed-pump-racks and lathe-gear-engagement.

Result: 133 pass. The one failure was the 368 fingerprint, which passes after the regeneration above.
