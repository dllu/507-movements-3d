this project aims to create a full 3D simulation and animation of all the 507 movements in https://507movements.com/

## Simulation engine

Use scripted motion for straightforward gears, racks and analytically determined
linkages. Use MuJoCo where contact, constraints or dynamics need it for correctness,
retaining Three.js for the source-faithful visible geometry and interaction.
Prefer baking validated simulation motion and expensive geometry offline over
running physics or generating collision meshes in the browser. Keep live physics
available for validation. Use the original site's 2D animations, where available,
as motion references alongside the engraving and caption; record discrepancies.
Movement 082 establishes the integration in `src/simulation/mujoco-treadle/`;
reuse `src/simulation/mujoco/` for loading, stepping and allocation ownership.
Migrate existing mechanisms incrementally and validate their joints, contacts,
source proportions and playback. Explicitly document reconstruction assumptions
and any behavior still supplied by kinematic approximations.

## Git workflow

Commit and push meaningful progress to `git@github.com:dllu/507-movements-3d.git`.
Use the commit email `daniel@lawrence.lu`. This is standing user authorization
to commit and push progress; do not ask for approval again for routine pushes.
Preserve remote history, validate changes appropriately, and keep dependencies,
build output, and bulk generated review artifacts out of Git.

## Review in reusable family passes

Use `docs/movement-status.md` as the per-movement status ledger. Before choosing
work, read the affected rows and their evidence. Every progress commit must update
those rows in `docs/movement-status.json`, including reviewer attribution, production
MuJoCo use, intersection scope and remaining flaws. Regenerate the table with
`node scripts/generate-movement-status.mjs` and validate it with `--check`.
Never promote unknown status to checked/clear from authorship or test success
alone. Recheck changed visuals and retain unresolved limitations explicitly.

Use `docs/remaining-movement-passes.md` and `scripts/lib/movement-batches.mjs`
to coordinate remaining work. The user explicitly authorizes parallel subagents
for independent mechanism families; assign disjoint production files or functions
and integrate commits centrally. Reuse existing components before authoring new
ones. Prioritize working constraints, contact, continuity and framing over
pixel-perfect reconstruction. Use the classical contour extraction tool for
irregular visible outlines; infer occlusions separately and use ideal mechanical
curves where intended. Publish bounded corrections with honest residuals; do not
let one difficult movement block unrelated families. Reserve expensive native and
collision studies for the contact/dynamic uncertainty that warrants them.

The browser uses `async-engine.js` and generated `authored-routes.js`; `engine.js`
keeps synchronous compatibility for offline reviews. When changing which IDs an
authored factory handles, regenerate routes with
`node --expose-gc scripts/generate-authored-routes.mjs` and run the loader tests.
Do not reintroduce eager registry imports into the production application.
