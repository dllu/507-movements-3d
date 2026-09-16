# Piston-guide family: 326–327

Reviewed the engravings, captions and available inline animation models at
[326](https://507movements.com/mm_326.html) and
[327](https://507movements.com/mm_327.html). Both pages load `anilib.js` and
register their mechanism with `ae.add_model`; the initial unavailable CSS class
alone is not evidence that an animation is missing. The existing crank radii,
connecting-rod lengths, source motion phases and analytical slider-crank laws
are retained. Full flywheels and rod extensions remain visible instead of copying
the engraving's page crop.

## Corrections

Both connecting rods now have genuine crank/wrist pin bores, including their
face rings. Both stationary crankshaft housings and sleeves have actual shaft
passages. Shortened the main shafts to just beyond the front crank face: their old ends
projected through the plane occupied by the swinging connecting rods.

326's translating piston rod now clears the frame front and foundation foot.
A lower slide bridge joins the rod to both shoes, closing the previous visible
gap beneath the center boss.
The planed slot has no inward bevel; guide-face strips terminate at the true
slot boundary and behind the slide cheeks. The decorative tubular slot outline
was replaced by a thin line, avoiding its intrusion into the shoes.

327's tread outer radius now equals the radius used by its no-slip law, rather
than exceeding it by 7.5 percent. Its guide strips sit entirely outside that
rolling envelope and extend across the actual roller contact plane. Both roller
bodies and hubs have axle bores; shortened face indices leave those bores open.
The crosshead bar is in a separate plane in front of the rollers, with its boss
behind the connecting rod. The cylinder, cap and gland now align with the piston
rod and have actual axial passages, replacing solid, offset cylinders.

Both movements disable ground/fog and use a nearly frontal initial camera.
Camera bounds include the complete 65-pose stroke envelope, including the full
piston-rod extension previously omitted by the hand-written bounds. The shared
bored-lathe helper supplies all new revolved solids. No mesh changes per frame.

## Validation and limits

The existing 326/327 suites and `engine-guide-solids.test.mjs` pass 21 tests.
New checks raycast complete finite shaft/pin cross-sections through rendered
rod eyes, bearings, rollers and cylinder passages. Thirty-three poses check
roller/guide gaps, roller/crosshead separation, shaft/rod depth clearance and
complete camera bounds. Existing tests cover analytical derivatives, fixed rod
lengths, stroke, zero crosshead yaw and opposite roller spin. Ideal no-slip
rolling remains prescribed; friction, engine forces and piston sealing are not
simulated. Display timing remains the existing readable cycle schedule.

This is a targeted clearance and presentation correction, not an all-pairs
collision proof. Axial layers, cylinder depth and joint fits are reconstructed
from front views. The long piston-rod extensions and complete cylinder remain
inferred continuations beyond the engraving. Rigidly joined parts may share
volume. Fine spoke/standard contours and other source proportions remain for
later review; the source animation is a dimensional reference, not proof that
every solid corresponds exactly to Brown's engraving.

Default and advanced oblique desktop views were inspected beside each engraving.
Seventeen projected full-cycle poses remain in frame (maximum absolute screen
coordinates 0.877 and 0.896); no browser errors. Full wheels and extensions make
the whole assembly taller than the cropped source. The shaft ends have a small
face offset to avoid coplanar flickering against their rigid crank webs.

Both final engine-guide builds also passed packaged play/pause and mobile-resize
checks at 390×844. The captured views include the final lower slide bridge and
shaft face offsets, without clipping or browser errors.
