# Geneva winding stops: 212 and 215

This records the initial bounded finite-geometry correction. Movement 212 still retains an unresolved broad-finger indexing law. The former 215 mouth collision described below was subsequently corrected by the compatible branch in [the 215 contact follow-up](geneva-stop-215-contact-review.md); that review supersedes the historical 215 handoff residual here. Neither pass claims complete passive loaded-contact qualification.

## Sources and retained motion

The official [212 page](https://507movements.com/mm_212.html) and [215 page](https://507movements.com/mm_215.html) contain inline animation models. They were checked directly, including their actual model declarations and timing data; the HTML tab's initial `unavailable` class is not an animation-availability test. The original engravings and existing source construction are retained.

212's animation uses a five-position stop, three complete indices and a partial final approach to its convex terminal sector. Its prescribed output advances linearly with input during each 51-degree ordinary index. 215 supplies the crescent, six radial slots, face pin and terminal convex sector; the implementation already uses the pin's exact bearing from the stop-wheel center for its interior indexing law. The demonstrations retain their continuous winding/reverse-return schedules instead of copying the official animation's discontinuous reset.

## Finite corrections

**215.** Outward cosmetic bevels expanded both actual working bodies beyond the nominal profiles. They produced about 0.0506 cam/wheel penetration and 0.0238 pin/slot penetration at the source pose. The crescent and stop wheel now use closed, unbeveled extrusion; the rear carrier retains its separate plane. Denser circular arcs reduce the remaining locking-profile chord overlap to roughly `1.8e-5` model units. The actual carrier/wheel axial gap is 0.085. The pin retains its original radius and orbit with a finer circular mesh. Interior contact witnesses lie on both actual slot walls and on the finite pin. Both terminal cusp/sector witnesses remain present, and a small attempted overtravel penetrates the real stop face in the blocked direction.

**212.** Denser locking circles reduce the roughly `0.000105` sampled dwell overlap below `3e-6`. Working finger and stop faces remain intact. Front hubs now physically span the large drawn wheel bores to the shaft connection.

**Both.** Solid beam ends at the rotating shafts are replaced by fixed through-bored support plates attached to the existing frame. New support meshes cast and receive shadows. Source-facing cameras, full-cycle bounds, disabled ground/fog, and minimum display durations of 14 seconds (212) and 16 seconds (215) improve readability. Playback retains geometry buffers.

## Remaining 212 problem and historical 215 investigation

**212 indexing.** The broad finger has about `0.001007` overlap at the middle of the first ordinary index, while selected earlier/later index poses have about 0.034 clearance. A small phase change alone cannot fit both flanks at the pinch. The oracle's interpolated schedule is therefore a reference animation, not a solved finite transmission. This pass improves the circular dwell and supports without shaving away the working finger or claiming that its indexing law is mechanically solved. A future correction needs a coherent contacting branch and compatible finger/slot flanks.

**215 handoff before the follow-up.** At input travel `-5.199966088277341`, just outside the nominal active interval, the finite pin penetrates the rounded slot mouth by about `0.029991`. The source orbit and switching angles are not a tangent-entry Geneva construction. Interior indices, interior dwells and terminal stops are checked separately from this unqualified handoff interval.

A bounded offline candidate relieved only the pin's inactive mouth sweep. It cleared the sampled full-cycle collision and retained the interior slot and terminal faces, but left a 0.022 drive gap at entry/exit, lasting about 0.02 input radians. The crescent also did not maintain sufficient contact to supply that missing transfer. **That relief-only law was rejected.** The later follow-up combines the relief with a compatible contacting branch; it does not retain this unsupported schedule. Removing the mouth material alone is not a contacting solution. A future pass must reconstruct the compatible pickup/release branch, retaining actual load faces and checking torque direction; only then consider a passive/native study if needed. Diagnostic candidate scripts remain in `/dev/shm/geneva36-relief.mjs`, `/dev/shm/geneva36-candidate.test.mjs`, and `/dev/shm/geneva36-cam-mouth.mjs` for the current session.

Friction, impact, inertia and watch-spring loading are not simulated. No force or loaded operation claim follows from these prescribed motion laws or geometric checks.

## Checks

```sh
node --test tests/movement-212.test.mjs tests/movement-215.test.mjs tests/geneva-stop-working-solids.test.mjs
```

The 17 checks comprise ten existing motion/source regressions and seven focused finite/presentation checks. The finite suite tests the actual rendered triangle surfaces, not only nominal 2D paths: selected interior index/dwell poses, both limits, both slot walls, terminal blocking direction, support bores and retained buffers. Working cam/wheel tessellation tolerance is separately declared as `2.2e-5`; other selected support tolerances are `2e-6`. The known mouth witness is logged and bounded, rather than requiring the defect to remain. It is outside the qualified interior interval.

Sampling uses up to roughly 2,400 surface points per body and 65 distributed poses plus selected boundaries. This is bounded evidence, not exhaustive all-pairs collision certification. The frame's remote members, decorative markers, all possible unsampled extrema and passive transfer forces remain outside this suite. Root performs the integrated source/default/oblique browser review.
