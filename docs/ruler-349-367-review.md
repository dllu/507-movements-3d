# Parallel rulers 349 and 367

Primary references are [349](https://507movements.com/mm_349.html) and
[367](https://507movements.com/mm_367.html), their captions and engravings.
349 has a working official canvas model; 367 has no animation setup. The
existing 349 two-degree-of-freedom geometry and smoothed symmetric demonstration
are retained. 367 retains an exact parallelogram and a calibrated distance
indicator, with a revised illustrative travel range appropriate to its arc.

## Reusing the drawing without manual tracing

The existing OpenCV extractor recovered each engraving's contours in about
15 milliseconds. Contour 20 of 349 and contour 30 of 367 enclose the visible
arm interiors. Their simplified outlines are normalized using the pin centers
stored alongside each source SHA-256 in `ruler-arm-profiles.js`; one contour
supplies all matching arms. `ornamental-ruler-arm.js` combines the outline with
ideal circular eyes and cuts actual pin holes. The lower 349 outline is reflected
from the upper one. There is no image processing in the browser.

To reproduce the observed boundaries:

```sh
python scripts/extract-engraving-contours.py public/engravings/mm_349.png --output /dev/shm/ruler-349
python scripts/extract-engraving-contours.py public/engravings/mm_367.png --output /dev/shm/ruler-367
```

Run `python scripts/generate-ruler-arm-profiles.py` with the optional OpenCV
environment to regenerate the normalized production profiles. It uses the
default threshold and 0.8-pixel simplification. Convert pixel Y to
upward coordinates, subtract the first recorded pin center, and project onto
the pin-to-pin vector and its perpendicular, dividing both by the squared pin
distance. Those dimensionless coordinates are scaled by the actual link length
when building the solid. The extraction retains hand-drawn ornament; circular
bores, duplicated parts, depth layers and hidden interfaces are reconstructions.
It does not infer mechanism topology or occlusion automatically.

## Corrected working geometry

349's four arms previously met as overlapping solid eyes, and the middle bar
hid those joints. The upper/lower arms now occupy separate layers above the
three bored bars. Six common pins span the members. The invented paper slab
is omitted; the default view faces the source plan without ground or fog.

367's tube-shaped arms and solid pivot bosses become flat bored plates with
pins passing through real blade holes. The indicator is a constant-width flat
strip beneath the arms and above the scale/ticks. The old polynomial produced
a visibly different sweeping curve; an ideal circle fitted from contour 21
restores the rounded source form. Its outer edge, rather than a tube centerline,
defines the scale calibration. The radius is rounded to 1.28 model units and
the demonstration spans 116–145 degrees, keeping every reading on a unique
branch of the arc. The initial 119-degree source pose is unchanged. The loop
uses a wrapped phase and the display profile has been refreshed.

## Checks and limits

The 16 existing tests retain source, closure, derivative and calibration checks.
Five additional tests check source hashes, actual open bores, pin engagement,
finite arm/bar/indicator clearance in both directions over 65 poses, the
calibration's proximity to the rendered outer edge, and fog/ground treatment.
Default/source and oblique browser views show both mechanisms; a 17-pose view
check remains inside the frame (absolute projected coordinates below 0.94).

These are ideal rigid planar mechanisms, with engineered running fits and depth
layers. The source does not specify masses, clearances, speeds or numerical
scale units. 349 still demonstrates one symmetric path through its broader
workspace; the finite-geometry sweep covers that animated path, not every
possible manual configuration. 367's circular fit and travel limits are a
reconstruction, not a measurement of a historical instrument. No loaded contact
or friction qualification is claimed.
