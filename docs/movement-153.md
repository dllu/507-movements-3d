# Movement 153: stud disk and elbow bar reverser — review open

The production animation remains unchanged. The first review confirms a
scripted contact-release error, and the new native prototype is diagnostic,
not suitable for playback or baking.

The [source caption](https://507movements.com/mm_153.html) specifies direct
stud contact on the bar's underside projection, followed by return through
the elbow lever and front bar stud. The existing geometry follows the main
landmarks, with an approximately diametric pair of disk studs. Its analytic
animation stops the return once the bar reaches its chosen left position,
then resets the elbow with a prescribed quintic motion labeled as gravity.

## Confirmed production contact error

`node scripts/review-stud-reverser-legacy-contact.mjs` checks the actual rendered
stud and lower-arm meshes in both directions at 241 half-cycle poses. Of
645,880 vertex, edge-midpoint and face-center queries, 26 poses contain
penetration above 1e-5. Maximum sampled depth is **0.03722 world units**
(2.66 engraving pixels), at 3.35 seconds during the purported gravity reset.
This result does not depend on MuJoCo, mass estimates or damping assumptions.
See `docs/validation/153-legacy-contact.json`.

At the scripted left limit (2.916875 seconds), the return stud still contacts
the lower arm's straight side at station 89.91 source pixels; that arm extends
119.08 pixels from the pivot. The bar reaching its source X coordinate is not
an actual release condition. The subsequent scripted reset moves the arm
through a stud instead of respecting that continuing contact.

## Passive native prototype

`src/simulation/mujoco-stud-reverser/physics.js` has three coordinates: driven
disk rotation, passive horizontal bar translation and passive elbow rotation.
Only the disk receives an actuator. Six convex collision shapes come from the
actual stud, lug and arm vertices; only the intended working pairs collide.
The bar has inferred guide friction and damping. Gravity and an inferred
lower angular stop replace the analytic elbow reset. The remote upper angular
limit is only a prototype bound, not a source feature.

Masses currently come from the legacy meshes, including overlapping decorative
volumes, normalized to bar mass one. These are provisional. Nonworking contacts,
finite bearings and complete assembly clearances are not qualified. Large
excursions can pass through hardware excluded from this prototype; they are
failure evidence, not plausible complete-machine behavior.

`node scripts/probe-stud-reverser.mjs` runs six 12-second disk revolutions at a
0.00025-second timestep. The original geometry loses the intended operating
cycle: the bar settles at -1.72552 instead of reciprocating between 0 and
1.02440. The lever subsequently rotates beyond the intended range. A 13%
shorter output arm (`OUTPUT_SCALE=.87`) also fails: the bar settles at +1.89124.
Neither result is accepted as a reconstruction. Reports with source hashes:

- `docs/validation/153-passive-prototype.json`
- `docs/validation/153-short-output-probe.json`

The latter is reproduced with
`OUTPUT_SCALE=.87 REPORT=docs/validation/153-short-output-probe.json node scripts/probe-stud-reverser.mjs`.
Raw trajectories go to `/dev/shm/153-passive-samples.json`; each run replaces it.
The separate short-arm raw trajectory is retained privately as
`/dev/shm/153-short-output-samples.json`.

Two native tests pass: only the disk is actuated; its studs move the passive
bar during the initial direct stroke; removing contact leaves that bar
stationary. These prove the prototype does not prescribe follower motion,
not that it implements a functioning reverser.

Next: reconstruct a mechanically possible elbow/stud release and handoff,
checking finite arm-end contact against the source before changing production.
A shorter output arm alone is rejected. Then validate passive cycles, physical
supports, full rendered clearances and timestep sensitivity before baking.

## Stepped input-arm candidate

A subsequent depth-relief trial now produces repeated passive strokes. The
new `mujoco-stud-reverser/geometry.js` keeps the original input-arm plan outline
but raises its inner 100 source pixels above the disk stud ends. Only the
remaining distal 19.08 pixels and rounded tip stay at working depth. The
raised arm's rear face is Z=0.80; disk studs end at Z=0.73, leaving 0.07 axial
clearance. The distal part extends forward to join the raised portion. This
is an **inferred hidden step**, not a feature established by Brown's engraving.
Both pieces exist as rendered solids and native collision meshes; the relief
is not implemented by turning contacts off during part of the cycle.

With guide frictionloss 2 and damping 1 (bar mass normalized to one), gravity
returns the elbow against its lower stop and both followers remain passive.
The original-length output arm is retained. The bar range in the sixth cycle
is 0.04763–1.02468 at dt=0.00025, and 0.04708–1.02471 at dt=0.000125. Its held
left position is about 3.4 source pixels to the right of the original pose.
The drive takes 12 seconds per disk revolution, giving two six-second strokes.
Guide resistance is a reconstruction assumption, not a measured source load.

Halving the timestep changes matched sixth-cycle bar samples by at most
0.0005452 (0.039 source pixels), disk angle by 0.0001841 rad, and elbow angle by
0.0013584 rad. The third physics test checks sustained reciprocation and cycle
closure. These tests do not yet qualify the full mechanism or its inferred
friction model. The earlier rejected reports remain historical results for
commit `ca75fc5`; they are not source-hash snapshots of this revised factory.

Reproduction:

    INPUT_MIN=1.4 FRICTION=2 REPORT=docs/validation/153-relieved-prototype.json node scripts/probe-stud-reverser.mjs
    cp /dev/shm/153-passive-samples.json /dev/shm/153-relieved-samples.json
    INPUT_MIN=1.4 FRICTION=2 DT=.000125 REPORT=docs/validation/153-relieved-fine.json node scripts/probe-stud-reverser.mjs
    cp /dev/shm/153-passive-samples.json /dev/shm/153-relieved-fine-samples.json
    node scripts/review-stud-reverser-relief.mjs
    node --test tests/stud-reverser-physics.test.mjs

The rendered relief audit covers 601 native poses and 1,812,616 bidirectional
surface queries. The raised inner arm has no sampled penetration with either
stud. Ten poses have soft contact on the distal driving face, maximum depth
0.0005337 (0.0382 source pixels), rather than the old reset penetration of
0.03722. This is a working-arm/stud audit only. Reports are
`153-relieved-prototype.json`, `153-relieved-fine.json`,
`153-relieved-refinement.json` and `153-relief-contact.json` under
`docs/validation`. Source, right-stroke, return, release and oblique renders
were captured from the actual engine; private screenshots are `/dev/shm/153-*`.

Next: replace overlapping legacy bearing/axle solids with real bores, construct
finite lower-stop and bar restraint hardware, recompute nonoverlapping masses,
and inspect all body pairs through the passive trajectory. Then test the
revised dynamics and bake a converged cycle. Production remains unchanged
until those checks and packaged playback pass.

## Bored hardware, physical stop and supported bar

The candidate now replaces the solid disk, elbow and guide-roller hubs with
bored solids. The return arm is moved 0.05 forward so its rear face clears the
bar by 0.03 while still engaging the projecting bar pin. The initial assembly
check had found eleven interfering pairs; the revised assembly clears them.

Hubs, stud ends, collars and the disk rim now begin at their host faces rather
than overlapping them. The return and raised input arms meet the elbow hub
at its outer perimeter. The moving-volume check finds no penetration above
1e-6 in 46 same-body mesh pairs (43,896 surface queries). These designed
interfaces and finite checks support the revised mesh-integrated masses;
they are not an exact CSG union-volume proof. Decorative floating indexes
were removed.

A cylindrical fixed stop now contacts the raised input arm at its rest angle.
The relieved model has no angular joint limit: gravity reset is stopped by
that finite collision geometry. A rear bracket supports the stop. Two C-shaped
bar guides remain engaged over the whole stroke and prevent lift or movement
out of plane. The original left support roller alone loses engagement near
the right end of travel, so it cannot provide the complete guide constraint.
The added hardware is inferred and explicitly visible in the 3D view.

With the updated masses and physical stop, the fine-step sixth-cycle bar range
is 0.04069–1.02452. Its left position is 2.91 source pixels right of the drawn
pose. Consecutive settled cycle endpoints differ by 2.41e-10 in bar position
and have effectively zero follower velocity. Timestep halving changes sampled
bar position by at most 0.0005053 (0.0361 source pixel), disk angle by
0.0001805 rad, and elbow angle by 0.0022624 rad near impact. Three native tests
pass, including sustained passive reciprocation and the compiled absence of
a lever joint range in the relieved model.

`review-stud-reverser-assembly.mjs` now checks 43 parts and 626 distinct-body
pairs through 65 native full-cycle poses: 3,843,468 bidirectional queries,
zero unintended interfering pairs. Working stud/lug, stud/arm, return-pin
and physical-stop contacts are reported separately as soft contacts. The
largest detected working penetration in this sampling is 0.0000541. This
coarser full-assembly sample set does not supersede denser working-contact
checks or prove continuous clearance. Source and oblique native renders were
inspected after the hardware changes.

Current reports are `153-supported-prototype.json`, `153-supported-fine.json`,
`153-supported-refinement.json`, `153-assembly.json` and
`153-moving-volumes.json`. Older `153-relieved-*` reports describe the preceding
geometry at commit `8a5acef`. Regenerate the current trajectories using the
same `INPUT_MIN=1.4 FRICTION=2` settings, with `REPORT` pointing to the supported
report names, and preserve raw trajectories as
`/dev/shm/153-supported-samples.json` and
`/dev/shm/153-supported-fine-samples.json`. The two assembly scripts consume the
latter. Run `node scripts/review-stud-reverser-moving-volumes.mjs` for the
within-body volume check.

Next: bake the settled fine-step trajectory, validate interpolation and the
complete between-frame motion, then run production build and packaged playback
before switching the loader. Production is still unchanged.
