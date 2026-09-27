# Pass 77 lane dc: disconnected-part fixes (290, 291, 310, 332, 412, 470, 473, 492, 500)

Lane p77-dc continues lane p76-db, which was stopped part-way through its work. Its uncommitted fixes for 290, 332, 412
and 470 are kept unchanged. Its rigid-rod edit for 500 was checked: the rod is built once at its constant length,
`L(2)` to `rodLength - L(2)`, inside the eye rings. It is then carried by `rod.position` and `rod.rotation.z` from the
lug pin towards the arm pin. The edit is complete and consistent.

Tool: `node scripts/screen-disconnected-parts.mjs` (docs/p74-disconnected-screen.md).

- **Before.** Pass-74 screen results for the IDs p76-db fixed. For the others, the p76-db screen
  (`/dev/shm/p76db-screen.json`), which was re-run at the start of this lane (`/dev/shm/p77-dc/screen-before.json`).
- **After.** `/dev/shm/p77-dc/screen-after.json`, plus single-ID worker reruns.

Captures are in `/dev/shm/p77-dc`: `before/`, `after/`, and phase and rotated captures in `c291b/`, `c310/`,
`c473/` and `c492/`.

## Screen artefact found (not fixed here; the tool is shared)

`screen-disconnected-parts.mjs` builds surface samples from `item.mesh.geometry` as it stands after the last sampled
phase, not from `item.geometries[k]`. A deforming mesh is therefore measured at every phase in its last-phase shape.
This covers ropes rebuilt each frame and in-place reshaped solids such as 500's disk A. The main effect is on ropes
between moving parts, which produce false "floating" parts. This caused 473's bell and hand-grip flags (see below).

Fluid classification by role can also misfire. In 473, `shaft-exhaust-pipe-through-water` matched the fluid pattern
`(^|-)water$`, so the solid inlet pipe was ignored.

## Per movement

| ID | before | after | change |
|---|---|---|---|
| 290 | rod C 0.03 short of the chops | 0 detached, 0 near-miss | p76-db (kept): the rod's neck rectangle reaches row 65 |
| 291 | balance group near-miss 0.10 (spring i-k / roller); wheel never touches stop d (0.11 at every phase) | balance group 0.020 from the wheel (free balance, running clearance) | stop d moved 7 px (see below) |
| 310 | wheel group near-miss 0.0425 (tip 3 / left bow) | unchanged, 0.0425 | none; the gap is not visible |
| 332 | D, C and E eyes not engaging their pins (≥0.02) | 0 detached | p76-db (kept): eyes bored to their pins + 0.005 |
| 412 | pawls lift 0.188 clear of the rim | 0 detached | p76-db (kept) |
| 470 | anvil block 0.44 from the standards' feet | 0 detached | p76-db (kept): thin bed plate under both feet and the anvil |
| 473 | lower check 0.80 floating (persistent); grips 0.29; bell group 0.27 | 0 detached | pipe role renamed; ropes rigid; grips on constant-length ropes |
| 492 | hook group 0.22 floating at phase 0.535 | unchanged (post-release) | none; intended release |
| 500 | section case, pipe, nipple and flange 0.61 from the dial; rod 0.074 short of its pin | section: 0 detached; rod short-of-pin gone | section dial and glass reach the case wall |

### 291

The flagged 0.10 spring/roller near-miss is the balance's free arc: stud a is clear of the passing spring except at
discharge. The balance and wheel arbors have no drawn frame, as Brown draws none, so these groups join the main
assembly only through contact.

While checking this, a real visible fault showed at every phase. Brown draws the roller's periphery overlapping the
wheel's tip circle. That periphery caught the tooth under it 0.11 before any tip reached stop d, so the wheel rested on
the balance roller all the time and d never locked. The stop was drawn visibly standing off the tip. The plate-pose
start also made the wheel recoil about 0.05 rad early in each cycle.

Stop d (the default `tune.dx`) moves from x 188 to x 181, keeping its 11 px width and its bottom on Brown's y 215:

- the tip now locks on d's face in the rest phases
- the tooth under the roller stands 0.019 clear, so the balance is free except at unlocking and impulse
- the worst backward wheel step falls from 0.050 to 0.005 rad, during impulse
- the wheel touches the roller only in the notch during impulse

Captures: `c291/tile.png` (before) and `c291b/tile.png` (after). The residual is that d stands 7 px nearer the
roller than Brown's.

### 310

Tip 3 against the left bow (0.0425) is the tip's plan clearance from the swept-carved stop face. In the default view
the tip overlaps the stop face in projection. At ±60° and from above, no gap can be resolved at review scale (`c310/`).
The wheel bearing's bracket is removed by source presentation, because Brown draws none, so the wheel group again joins
only through contact.

No change was made. The baked plates were not rebaked by this lane. In the working tree, only the 310 entry differs
from HEAD (from p76-db's crossbar move), and 309, 311 and 312 are byte-identical.

### 473

- The inlet pipe role is renamed `shaft-exhaust-pipe-standing-in-tub`. The check seat sits on the pipe top at
  y 0.4925 and the pipe stands on the tub floor (gap 0.005), so the lower check valve (seat, disk and guide wings) is
  joined.
- All four ropes are now built once at their constant length and carried rigidly by their transform (`setRopeBetween`).
  They no longer rebuild their geometry every frame.
- The pull ropes now keep their length (2.85). Before, each grip was pinned at y 0.20 while its rope stretched and
  shrank by ±0.22. Now the grip hangs below its lever end and rises and falls with it (`c473/tile.png`).
- The bell group and the upper check disk were flagged only because of the rope-geometry artefact. They were joined
  already: the disk sits on its seat and its wings run in the bore.

Intersections (0.01 spacing, 129 samples):

- the rope ends are seated 0.042–0.044 into the lever ends, and the suspension ropes pass 0.028 through the lug eyes
- the valve disks seat on their seats with 0 overlap
- no new solid overlaps

### 492

At phase 0.535 the tongue has completed its exit swing (`tongueProgress` = 1) and the hook is in its free rise. The
hook stays on the tongue up to that exit (`c492/tile.png`: 0.45, 0.49, 0.50 and 0.52 engaged, 0.535 released). The
hook is carried by the tackle falls, which run beyond the plate. This is the intended release, not a disconnection, so
no change was made.

### 500 (section figure)

The section's dial plate stopped at row 262, and the glass at row 236. Both hung free inside the case, which is why
the case, pipe, nipple and flange group was linked to the dial only through the deforming disk A. Brown carries both
across the case. They now run to row 222, 1 px into the case wall whose inner face is row 223, so their rims do not
share the wall face (the first try at row 223 z-fought).

The rod meets both pins (the rigid rod from p76-db). Loop seams are clean.

Intersections (0.02 spacing, 65 samples; 0.01 spacing runs out of memory at 4 GB): only the known 0.065 face-view ball
joint and the rod seated in its eyes (0.0086).

The remaining screen items are all in the face view, outside this brief:

- The fixed journal through the pointer pinion and the sector-e pivot bearing touch no fixed part. The train reaches
  the case only through disk A, which the screen shows as a 0.1675 near-miss.
- The dial face stands 0.03 inside the bezel torus (hidden behind the drum).

## Tests

All pass:

- boat-detacher-contact, capstan-491-finite, capstan-entwistle-solids
- elastic-gauge-working-solids, gravity-escapement-working-solids, hammer-working-interfaces
- marine-parallel-solids, mercury-instrument-working-solids
- movement-310, 332, 412, 470, 473, 492 and 500
- plate-escapements (16/16), water-sealed-pump-solids

`check-loop-seams --ids=291,473,500`: 0 seams, 0 pops.

## Proposed ledger text

- **290**: assessment reasonable. visibleFlaws "". limits unchanged ("The wheel mostly drops; the bob is inferred below
  the crop.").
- **291**:
  - assessment reasonable
  - visibleFlaws ""
  - limits: "Parts are separated in depth rather than by drawn shapes; the roller and balance stand at the fitted roller
    centre, 4 px from Brown's arbor mark; stop d stands 7 px nearer the roller than drawn so the tip locks on d rather
    than on the roller; arbors have no drawn frame."
- **310**:
  - assessment reasonable
  - visibleFlaws ""
  - limits: existing text + "Locked tips stand about 0.03–0.04 off the swept stop faces in plan (hidden in projection);
    the wheel arbor has no drawn bracket."
- **332**: assessment reasonable. visibleFlaws "". limits unchanged.
- **412**: assessment reasonable. visibleFlaws "". limits unchanged.
- **470**:
  - assessment reasonable
  - visibleFlaws ""
  - limits: existing text + "A thin bed plate joins the standards' feet and the anvil on Brown's base line."
- **473**:
  - assessment reasonable
  - visibleFlaws ""
  - limits: existing text + "The hand grips rise and fall with the lever ends on constant-length ropes."
- **492**: assessment minor. visibleFlaws "The tackle block is a plain wooden shell rather than Brown's stropped block."
  limits unchanged.
- **500**:
  - assessment minor
  - visibleFlaws unchanged ("At rotations of 60° or more the section figure overlaps the gauge in projection …")
  - limits: existing text + "In the face view the pinion journal and sector pivot bearing are carried by nothing
    fixed; the section's dial and glass are seated in the case wall."
