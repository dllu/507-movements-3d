# Pin and three-legged escapements 305–307

Primary references: [305](https://507movements.com/mm_305.html), [306](https://507movements.com/mm_306.html), [307](https://507movements.com/mm_307.html), and their local engravings. All three official pages mark the animation unavailable. This pass groups pin carriers, pallet openings, shafts and journals. It qualifies **305's finite upright impulse**, while retaining explicit handoff and three-legged working-contact residuals.

## 305: correct solid sides of the Z opening

The upper-left and lower-right white regions in the engraving are openings. The previous model instead filled them with solid L-shaped pallets, putting their upright faces on the wrong sides of the pin. The corrected upper solid is to the pin's right and the lower solid to its left. Their nearly horizontal dead faces are actual circular faces concentric with the pendulum pivot. The pin radius is 0.024 at the retained 0.075 eccentricity: its radius/orbit ratio now matches the small pin in the source more closely, instead of nearly filling its own orbit. The inherited 1:60 eccentricity/axis-distance rule is retained as an inferred construction; Brown does not dimension it.

A real bored disk and rear housing replace the overlapping arbor stack. The arbor ends behind the working band; a small attached face cap carries the eccentric pin. Two stand-offs attach the raised pallets to the outer plate. The suspension eye has a real bore and its neck has finite overlap. During every sampled upright impulse, independent nearest-triangle measurements give pin/face gap at most 2.1e−10 and a contact normal that supplies positive work to the prescribed pendulum motion.

**The full escapement is not contact-qualified.** A 2,049-pose check still finds about 0.000601 penetration at a release corner, and up to 0.00970 separation from a nominally active dead face. These are distinct from the verified straight-face impulse. The release/landing schedule still prescribes the pin's motion and brief unsupported holds; it does not establish passive locking, free drop or self-sustained oscillation. A bounded corner projection experiment was not adopted. The working faces were not hollowed or moved away to hide this residual.

## 306–307: actual support and carrier geometry

306 has a bored wheel hub, a fitted fixed arbor and a real rear strut connecting the arbor to the cross-bridge. Its four fastening screws pass through actual bores outside the working aperture. The remote pendulum pivot remains an idealized cropped support, as in the source's partial plate view.

307 has bored wheel and suspension hubs. Its plate joins the pivot eye around an actual bore. A rear carrier disk connects the three backward impulse pins to the common hub; previously the pins ended short of both the hub and the front locking arms.

Both retain serious **working-contact residuals**: an independent 129-pose, bidirectional actual-solid scan measures about 0.149 tooth/plate penetration in 306; 307 has about 0.0933 tooth/stop and 0.0698 pin/impulse-backing penetration. Their generated zero-size reference trajectories do not validate those surfaces. No working material has been removed to pass a clearance test. A future pass must solve each finite aperture/stop/impulse profile together with its release sequence, and then evaluate positive loading and adjacent-tooth clearance. No native contact result is claimed in this pass.

## Validation and presentation

`node --test tests/movement-305.test.mjs tests/movement-306.test.mjs tests/movement-307.test.mjs tests/pin-escapement-working-solids.test.mjs` — **30 checks**: 24 inherited kinematic/source checks, updated to distinguish prescribed reference states, and six new finite checks.

The new checks cover 162 actual upright-impulse samples and positive work in 305; 129 poses of its independent arbor/pin/pallet/disk neighbors; 65 poses of 306/307 journal and carrier neighbors; actual interior witnesses establishing attached pin carriers, pallet stand-offs and frame support; the separate dense 305 handoff diagnostic; and retained scene/geometry buffers. The independent family baseline scan is `/dev/shm/pin31-audit.mjs`; experimental 305 files are `/dev/shm/pin31-prototype*.mjs`.

Misleading generated contact tubes and global point-contact markers are suppressed. Real working surfaces remain visible. Each model fits its complete visible cycle, disables ground/fog and enforces at least six seconds per pendulum period. The existing prescribed motion retains its beat ratio and periodicity. Spring energy, inertia, friction and free impacts are not solved.

Browser source/default/front and three advanced-pose captures were reviewed for all three models. A 17-pose visible-vertex framing sweep found maximum normalized screen extents of 0.884, 0.890 and 0.898 for 305, 306 and 307, with no clipping or browser errors. Default draws/triangles were 48/12,760, 40/5,888 and 35/6,280 respectively. Review artifacts remain outside Git at `/dev/shm/pin31-final-*.png` and `/dev/shm/pin31-final-browser-review.json`.
