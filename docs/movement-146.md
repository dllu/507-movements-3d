# Movement 146: measured framed yoke

The [source page](https://507movements.com/mm_146.html) has no animation for
146. Its caption describes a rotating wrist driving a translating yoke, and
notes that a differently shaped groove could give uniform reciprocation.
A straight horizontal groove gives sinusoidal vertical motion; that remains
an appropriate analytic model. The application now loads a reconstruction
from `framed-yoke.js`; the old factory remains available for diagnostics.

[Manual raster measurements](validation/146-source-measurements.json) reveal
that the wrist radius from the disk center is about 0.784 times the disk radius,
versus 0.56 in the old model. The broad yoke is about 1.374 times the disk
diameter, versus 1.06 previously. Landmark uncertainty is a few engraving pixels,
far smaller than either discrepancy. The resulting stroke should be roughly
187 engraving pixels, versus 133 previously. The new model uses those measured
dimensions and the measured source wrist position, and traces the broad frame.

Increasing the crank radius alone is insufficient: the old upper stem
would cease to reach its fixed guide near the bottom of the stroke. Furthermore,
the upper stem drawn in the engraving is only about 124 pixels long, shorter
than the corrected stroke even before allowing for guide length. The source
omits guides, so longer stems or another support construction must be explicit
reconstruction assumptions.

The reconstructed stems are extended beyond the engraved ends and run in
rectangular guide sleeves throughout the corrected stroke. The disk shaft
terminates ahead of the rear yoke and runs in a front bearing, avoiding a shaft
through the moving frame. The bearing and guides represent fixed external
supports; their mounting structure is omitted. These supports, depths, stem
extensions and the precise hidden groove geometry are reconstruction assumptions.

The slot is cut through the complete assembled frame and its bridge. It has
0.0005 world units of radial running clearance around the wrist (about 0.025
engraving pixels). The analytic motion uses the nominal centered constraint;
backlash and contact dynamics within that small clearance are not simulated.
The seven-second cycle is sinusoidal, not a claim of uniform rectilinear speed.

The [assembled surface check](validation/146-assembly.json) passes 129 poses,
seven visible meshes and 15 independent part pairs, with 2,323,290 surface-point
checks and no detected penetrations. Same-body joins are excluded. This is a
sampled check, not a continuous swept-volume proof. Focused tests check actual
groove clearance, measured wrist and frame proportions, guide coverage and
complete camera bounds at 257 poses, plus restart and fog settings. Front and
rear candidate views were reviewed. Geometry is inexpensive to create once;
playback only rotates the disk and translates the yoke, without MuJoCo or WASM.
The production build and packaged desktop/mobile playback, orbit and exact
restart checks pass. The final packaged desktop and mobile views were reviewed.
