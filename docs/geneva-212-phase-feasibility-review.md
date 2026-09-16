# Movement 212: local phase feasibility

Read-only follow-up against production baseline `ceb68ef`; geometry and playback
are unchanged. The source's registered animation is still the reference for its
five-position winding stop, but its linear output interpolation is not a finite
contact solution. See the [official page](https://507movements.com/mm_212.html)
and the [earlier interface review](geneva-stop-working-surfaces-review.md).

The earlier conclusion that no small phase adjustment fits the midstroke pinch
was too strong. A finer local search finds a clear pose without changing either
profile. Run:

```sh
node scripts/screen-geneva-212-phase-fit.mjs
```

At input angle **0.4450589593** (half the first 51-degree index), the existing
output angle **−0.6283185307** has measured penetration **0.001006966**. An output
offset **−0.0007851868 rad**, approximately **−0.04499 degrees**, changes the
output to **−0.6291037175**. Selected actual vertices, edge midpoints and triangle
centers checked in both directions now have minimum separation **+1.148e−7**.
An independent closed-polygon intersection of the complete planar outlines is
empty, with **zero intersection area**. Both profiles remain at their original
depths; no working face is removed or hidden by axial separation.

This is a narrow feasible pose, not a completed transmission. The script
optimizes only that pose over successively smaller angle ranges. It does not
construct a continuous loaded branch, validate actual reaction normals,
reconstruct entry/exit or terminal stopping, or establish reverse operation.
The source law's earlier/later gaps also remain. Production therefore retains
its explicit unresolved-contact note.

The next correction should first continue the finite contacting branch with
both actual profiles intact, checking neighboring teeth and both input
transitions. Profile relief is not established as necessary by the old
midstroke witness. If the branch ceases to exist elsewhere, preserve that
specific witness before changing geometry. This differs from
[213's finite-width obstruction](split-rim-213-feasibility-review.md), where the
unchanged pin cannot fit the regular tooth passage even at the best phase.

Bulk search and witness output: `/dev/shm/geneva212-pass42-phase-fit.json`.
