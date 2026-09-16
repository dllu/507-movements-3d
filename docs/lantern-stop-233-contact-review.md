# Movement 233: finite lantern-wheel stops

The [official caption and engraving](https://507movements.com/mm_233.html) show two alternative stops for a lantern wheel: a pivoted free roller and a shaped latch. The page has no registered canvas/model animation. The existing analytical roller contact and latch envelope are retained; the demonstration withdraws one alternative before moving the wheel against the other, then restores the source comparison. The complete wheel remains visible despite its abbreviated lower edge in the engraving.

## Correction

The original rendered latch penetrated trundle 11 by **0.01901295**. Its extrusion bevel expanded the mathematically correct working envelope toward the trundle. The latch now uses a finite unbeveled plate with a real pivot bore. A **0.000015** nominal relief along the working normal accommodates the sampled curve's chord error while retaining its full load-bearing flank.

The roller's decorative torus extended 0.045 beyond the 0.43 working radius, penetrating a trundle by **0.00918605**. Its inset rim now stays inside the working disk's envelope. The 0.43-radius free roller and its rolling law are unchanged. The roller disk and arm now have real bores around a separate spindle, with the arm in front of the roller rather than intersecting it. Axial clearance between the disk and arm is **0.045**. The latch and roller still overlap the trundles in depth; the latch has **0.15** working overlap.

The two fixed pivot shafts now reach their frame and working eyes. The wheel disks and hub have actual shaft bores. Contact metadata now identifies physical trundles 0 and 11 consistently across repeated demonstration cycles; the wheel reverses to its original angle each cycle, so incrementing these labels previously named the wrong pins.

Ground and fog are disabled. The default camera faces the engraving, full-cycle visible vertices set the bounds, and the minimum displayed cycle is eight seconds. Changes are confined to factory 233 and its helper.

## Verification

Run `node --test tests/movement-233.test.mjs tests/lantern-stop-233-contact.test.mjs`. All **13 checks pass**: eight existing movement regressions and five finite-interface checks.

- Full trundle circles versus the actual latch perimeter and roller circle, at 513 poses, preserve continuous withdrawal, working contact and reseating. Latch minimum clearance is **4.76e-8**, with maximum working gap **0.00002028**; roller minimum is **−3.33e-15**, numerical roundoff at tangency.
- Actual rendered latch, roller disk, inset rim and arm surfaces are checked against every trundle at 65 poses. Minimum measured surface gap is **0.000002494**; the working faces remain within the trundle plane.
- Actual latch triangles agree with the analytical working normal. The seated roller reaction opposes clockwise motion with moment arm **1.707726**; the sampled initial latch reactions oppose counterclockwise motion with moment arm at least **0.571211**. The actual/analytic normal dot product is at least **0.9999964**.
- Pivot and spindle bores clear their finite shafts by more than **0.0038**. Roller/arm axial clearance, spindle alignment and working-depth overlap are checked.
- Full-cycle vertices fit the bounds. Repeated state queries and updates preserve mesh and geometry identities, and all demonstration boundaries have continuous position and velocity.

## Limits

The source compares two stop designs and gives no drive or bias mechanism. Their withdrawal, opposite wheel strokes, bias and reseating remain prescribed. The roller is a yielding detent: its reaction resists departure from the seated position, becomes radial near the crest, then assists reseating. The reconstructed yielding latch stroke also crosses a zero-moment configuration and changes reaction sign; this is not a proof of positive holding torque throughout a moving demonstration. A stationary loaded stop and a deliberately lifted release must be distinguished.

The finite geometry and useful seated/initial resisting normals are checked. Gravity, springs, friction, holding force, inertia and impacts are not dynamically solved. The small latch running gap does not itself exert force. Those assumptions are exposed in the viewer's reconstruction note; no MuJoCo force validation is claimed.

## Integrated browser check

Final source/default/oblique Chrome views load without errors or clipping.
The 17-pose visible-vertex sweep has maximum normalized extent .900;
default rendering uses 82 draws and 44800 triangles including shadows.
The production build passes in 23.46 seconds, and both 233/239 packaged
desktop/playback/mobile checks pass in 7.6 seconds. Their construction/update
screens have no flags or geometry growth. These checks qualify presentation
and interaction, not the passive load assumptions above. Bulk evidence is
outside Git under /dev/shm/family42-*.
