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
