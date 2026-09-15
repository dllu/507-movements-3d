# Movement 146: framed yoke (review in progress)

The [source page](https://507movements.com/mm_146.html) has no animation for
146. Its caption describes a rotating wrist driving a translating yoke, and
notes that a differently shaped groove could give uniform reciprocation.
A straight horizontal groove gives sinusoidal vertical motion; that remains
an appropriate analytic model, but the existing geometry needs reconstruction.

[Manual raster measurements](validation/146-source-measurements.json) reveal
that the wrist radius from the disk center is about 0.784 times the disk radius,
versus 0.56 in the current model. The broad yoke is about 1.374 times the disk
diameter, versus 1.06 currently. Landmark uncertainty is a few engraving pixels,
far smaller than either discrepancy. The resulting stroke should be roughly
187 engraving pixels, versus 133 currently.

Increasing the crank radius alone is insufficient: the current upper stem
would cease to reach its fixed guide near the bottom of the stroke. Furthermore,
the upper stem drawn in the engraving is only about 124 pixels long, shorter
than the corrected stroke even before allowing for guide length. The source
omits guides, so longer stems or another support construction must be explicit
reconstruction assumptions.

Next: rebuild the broad frame and hidden groove from the measured source pose,
provide support through the complete stroke, and test actual shaft, wrist,
groove and guide surfaces. Do not mark the existing 146 model verified based on
its analytic metadata or its previous tests.
