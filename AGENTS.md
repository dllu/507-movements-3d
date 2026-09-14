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
