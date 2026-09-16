# Movements 368 and 372: shared bevel and rack geometry

Primary references are [Brown 368](https://507movements.com/mm_368.html) and [Brown 372](https://507movements.com/mm_372.html), including their captions and engravings. Both official pages mark animation unavailable. No 2D animated oracle was available. Their existing analytical motion laws are retained; this pass corrects the visible contact geometry and joints.

## Changes

368's common horizontal shaft drives an 18/30 bevel pair and a 16-tooth spur gear of pitch radius 0.48. The bevel pair rotates the cylinder while the spur moves its rack-carried marking point. Thus the ratio, not an independent animation curve, sets the helix pitch. The smooth forward pass and reverse retrace remain an inferred hand-cranked demonstration, not an automatic return mechanism prescribed by Brown.

Both bevel gears now use the shared Tredgold back-cone involute approximation, with a common pitch-cone apex and the original complementary cone angles. The driven tooth geometry has a reconstructed 9.2-degree mounting phase; the analytical shaft and cylinder angles are unchanged. Real body bores clear the input and cylinder shafts. The estimated back-cone contact ratio is 1.523753.

The spur and rack use the same `rack-pinion-parts.js` geometry as the rack-output family. They share a 25-degree pressure angle, circular pitch and 0.001 nominal backlash allocation per member. The 0.042 addendum gives transverse contact ratio 1.083082. The tooth mounting phase accounts for the rack's initial translated position as well as the shaft angle. The rack backbone reaches the tooth roots, the guide cheeks clear the entire tooth width, and the table now has actual shaft and rack passages. The cylinder's table bearing and spur hub have finite bores.

372 retains its equal 18-tooth bevel differential, restrained hoop and weighed peripheral band. With the hoop held, the side gears counter-rotate. The band balances twice the transmitted side-shaft torque; power additionally requires measured shaft speed. This distinction appears in the reconstruction note. The shown torque, load and speed remain assumptions.

Its four gears now use common-apex 45-degree back-cone involutes with their original compatible mounting phases. Estimated contact ratio is 1.314983. The loose input sleeve, hoop boss and fixed end bearings have actual bores. End-bearing bores are aligned with the horizontal shaft rather than offset in depth. Cylindrical carrier arms reach through the planet journals, replacing square bars that occupied their bores; duplicate short axle overlays are hidden. The transverse carrier braces clear the central shaft. The shaft index is shortened to a free span so it no longer cuts through the independently rotating sleeve or fixed bearings.

Ground and material fog are disabled. Contact diagnostic spheres are hidden; useful rotation indices remain. The exported legacy `makePitchConeGear` factory in `authored-dynamometers.js` is intentionally unchanged because another movement imports it. Only the assembled 368/372 models receive the scoped correction helper.

## Validation

Run:

```sh
POSES=33 node scripts/review-368-372-contact-solids.mjs
node --test tests/movement-368.test.mjs tests/movement-372.test.mjs tests/scriber-dynamometer-solids.test.mjs
```

The saved report is `validation/368-372-contact-solids.json`. It hashes the relevant production and audit sources. It queries actual rendered gear bodies and teeth bidirectionally at vertices, triangle centers and edge midpoints. 368 covers a full forward traverse, including dwell; 372 covers one working tooth period. The rack audit includes its actual backbone and complete finite tooth row.

| Movement | Poses | Actual surface queries | Sampled penetrations | Maximum closest-surface gap |
| --- | ---: | ---: | ---: | ---: |
| 368 | 33 | 561,449 | 0 | bevel 0.000937; spur/rack 0.000908 |
| 372 | 33 | 1,093,410 | 0 | 0.001786 across all four meshes |

The focused tests check finite rack/table/guide clearance, shaft/body and shaft/bearing bores, the shaft index against the loose parts, and carrier arms against all four gear bodies. Existing ratio, contact-velocity, helix, torque and timeline tests remain. Combined suite: **21 tests**.

Default, front and advanced-phase browser captures produced no browser errors. 368 rendered 218 draw calls/61,496 triangles including shadows; 372 rendered 216/49,032 before its final visibility-only removal of duplicate short axle overlays. The full rack stroke fits the reserved camera bounds; its initial pose leaves additional space above the rack. Bulk captures remain under `/dev/shm` and are not committed.

## Limits

The conical flanks are a Tredgold approximation, not exact generated octoid or spherical-involute teeth. Surface samples and contact-ratio checks provide bounded clearance/proximity evidence; they do not prove continuous-time collision freedom or loaded tooth dynamics. The models retain prescribed analytical motion and ideal torque balance, with no claim to bearing friction, elastic contact, efficiency or structural strength. Historical tooth counts, phases, dimensions and speeds are unspecified. The static 372 weight illustrates a selected steady torque and does not simulate a live spring scale. Decorative support, band and stylus details were not exhaustively contact-qualified beyond the named checks.
