# Pass 86, lane p86-6: 116 pawl seating and 205 tooth roots

Scratch and captures: `/dev/shm/p86/p86-6` (not in Git). Captures use the
dev server with `shots.mjs` (the p86-3 capture script plus `hideName`,
`focusName` and `focusRole` targeting).

## 116: double rack with alternating ratchet clutches (baked MuJoCo)

### Before

Lane p86-3 found that each pawl was a thin capsule link (5.2 px wide) whose
1.4 px round nose bore on the middle of the ratchet's locking face and never
entered the root (`/dev/shm/p86/p86-3/B/tile116z.png`; this lane's
`before/tile-z.png`, `before/tile-view.png`).

### Change

- `src/simulation/mujoco-rack-rectifier/geometry.js`: each pawl is now one flat,
  bored plate in its ratchet's plane, following Brown's hooked outline. It has a
  round boss (r 3.2 px, bore 1.3 px on the existing pin), a body whose top
  edge arches over the ratchet, and a short claw. The claw's working face lies
  along the fitted locking face over 60% of its height. Its tip corner sits in
  the root, 0.02 px clear of both flanks in the built pose (pawl hinge 0). The
  underside is one straight edge from the boss to the claw, with a 0.9 px
  fillet at the claw. A passing tooth tip therefore slides along one flat
  collision face. A curved underside decomposed into many convex cells, and
  tooth tips snagged on the cell seams (see "Dynamics" below). Both pawls are
  identical. `profile.pawlTip`, `pawlHeel`, `pawlBoss` and `ratchetFace`
  record the seat. The `pawlRadius` option is replaced by `pawlSeat` and `hook`.
- `physics.js`: the pawls and shaft now start in the seated pose (0, 0), and
  the pawl spring rest is −0.07 rad past the seat. The old −0.2 rest with a
  −0.13 start gave the same 0.07 preload. The new `backlash` option (0.008 pinion
  rad) lengthens the nominal stroke to `pitchRadius × (π/2 + backlash)`. The
  capped stroke end moves 0.0036 world unit out, to ±0.74529.
- Backlash: the idle pawl now passes the next root before its pinion reverses
  and drops fully into it. The reversed pinion then closes a gap of about 0.4°
  of ratchet before its seated claw takes the drive. With the old stroke
  (backlash 0), the claw reached the face while still on the tooth tip. It
  then slid down the face, wedging the shaft ahead (speed −1.16 rad/s), and
  sometimes skipped a tooth (output −29.5 rad instead of −31.3 rad after 30 s).
  In 60 s runs, backlash 0.005–0.012 seats every stroke, 0.003 is marginal and
  0 skips.
- Rebaked with `node scripts/bake-mujoco-movement.mjs 116`. The loop is 6 s from
  66 s, with raw seam 0.019 px and round trip 0.023 px. The asset and
  provenance hashes (`mujoco-116.json.gz`, `.provenance.json`) are updated;
  116's provenance does not fingerprint package-lock.json.
- `scripts/audit-rack-rectifier-clearances.mjs`: the camera-bounds assertion now
  skips `stubExtension*` and `shaftTail0`. Both are added after the fit bounds
  and deliberately run on out of view, so the audit already failed on the old
  geometry (checked with backlash 0).
- `docs/mujoco-116-rack-rectifier.md`: updated the pawl, stroke, spring, dynamics
  and audit figures.

### Dynamics (native, 60 s, `116-dynamics.json`)

- Frame stroke ±0.74529. Rack/pinion error 0.063 px, input error 0.047 px,
  maximum native penetration 0.159 px, maximum reverse step 2.2e-6 rad.
- Pawl hinges stay between −0.0014 and 0.409 rad (the tooth-tip lift is about
  0.40), so the claws never fly.
- Away from reversals the driving pawl is within 0.0014 rad of the seat and
  0.08° of the face. Mean speed is −1.04720 rad/s (ideal −π/3). Step speeds
  range from −1.078 to −0.979 rad/s: the shaft runs 0.4% fast while driven
  and coasts about 6% slow while the backlash closes. Before pass 86 the range
  was −1.090 to −0.697 per step.
- Sensitivity: a 0.25 ms step and a doubled pawl spring both seat every stroke.
- Surface audit, 25 poses (`116-clearances.json`): 5,218,774 queries, maximum
  intended penetration 0.092 px (claw on ratchet), no unintended penetration.
  Pawl bore to pin clearance is 0.047 px.

### Captures (after)

- Default view beside the plate: `after/plate-vs-default.png`. At phase 0 the
  front pawl is seated in the root at Brown's pose: boss at 10 o'clock, claw
  at 12 (`after/tile-pzA.png`).
- Front pawl zooms at phases 0.05–0.45: `after/tile-pz.png`. It is seated and
  driving at 0.12–0.37 and clicks over a tooth back at 0.45 and 0.05.
- Rear pawl from behind (front parts hidden), phases 0.55–0.95:
  `after/tile-pzr.png`. It is seated at 0.55–0.75 and 0.87 and clicking at
  0.8 and 0.95.
- Eight-phase shaft zooms: `after/tile-z.png`, `after/tile-back.png`. Rotated
  views: `after/tile-view.png`. Plate crop, old pawl and new pawl side by
  side: `after/tile-plate-vs.png`.

### Tests and checks

- `tests/mujoco-rack-rectifier.test.mjs` (7 pass):
  - The driving test now asserts seating (hinge < 0.003 rad, face offset
    < 0.2°), a root drop before re-engagement at every reversal, and mean
    speed within 0.003 of π/3.
  - The per-step speed tolerance widens from ±0.04 to ±0.08 rad/s, the
    coasting cost of the requested backlash.
  - A new geometry test checks that the claw sits in the root (< 0.03 px),
    that the working face is parallel to the locking face and covers more than
    half its height, the gap, and the boss.
  - The disconnect-test output check follows the new zero initial pose.
- `tests/mujoco-baked-loops.test.mjs` 116 (3 pass), shifted-involute, runtime
  and engine tests pass.
- `check-loop-seams --ids=116,205`: 0 seams above tolerance.
- The camera-fit test filtered to 116 and 205 passes.
- `screen-disconnected-parts --ids=116`: 0 detached, 0 slivers, 0 lips. The
  near-misses are the existing bore clearances and pins.

### Remaining

- The rear pawl shares the rear pinion's muted grey, as before. From behind,
  it reads mainly by its edges.
- `screen-body-intersections --ids=116` screens the synchronous authored review
  study in `authored-gears-core.js`, not production. It reports 0.0485 rack/pinion
  overlap there. That study was not changed.

## 205: two cams driving alternating eleven-tooth rows

### Before

The p86-5 sliver screen found that both tooth rows stand beside the wheel body
(`/dev/shm/p86/p86-5/cz/zs02-205-tile.png`, `zs03-205-tile.png`). The body is
±0.18 deep with rim radius 3.0. The teeth occupy |z| 0.18–0.36 from r 3.0
outward, so each met the body only along its back root edge.

### Change (`authored-gears-core.js`, 205 branch only)

- Each tooth carries a root key in its own material. The key is an annular
  sector from r 2.86 to 3.08 over the middle of the tooth root (0.008–0.062 rad
  in tooth coordinates; the root spans −0.016 to 0.086). Axially it runs 0.06
  into the body and 0.02 into the tooth.
- The cams reach r 2.53 between teeth, so a full-width foot is impossible.
  Sampling the cams in tooth coordinates over 11 input turns found no cam
  point in the key's band inside r 3.2. The closest approach at the root
  corners is r 3.0004. The tooth outline in the front view is unchanged.
- `geometry.toothRootKey` records the key.

### Checks

- `screen-disconnected-parts --ids=205`: 0 detached, 0 near-miss, 0 slivers
  (previously 2 slivers ×11), 0 lips (`disc205.json`).
- `screen-body-intersections --ids=205`: worst solid 0.0000 (`int205.json`).
- `tests/movement-205.test.mjs`: 6 pass. The new test checks 22 keys, the body
  and tooth embed, the radii, and that neither cam comes within 0.05 of a key
  over 11 input turns.
- Captures: `after/tile-205.png` (default, rotated, tooth zooms) and
  `after/tile-205top.png` (rim-top views). The key shows between the rows as a
  small pad under each tooth.
