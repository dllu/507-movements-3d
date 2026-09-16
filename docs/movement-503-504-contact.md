# Movements 503–504: working teeth and journals

This review supersedes the contact and stepped-wheel limitations recorded for 503/504 in `movement-502-505.md` and `epicyclic-family-review.md`. Other movements in those reviews are unchanged.

## Source and motion

Primary references are [503](https://507movements.com/mm_503.html) and [504](https://507movements.com/mm_504.html), their captions and engravings. Both official pages mark their animation unavailable; this pass therefore has no animated source oracle.

503 retains the equal-bevel differential: the arm turns at the average of the two loose side-wheel speeds, and the carried pinion responds to their difference. The reconstructed equal 24-tooth wheels share a common apex and 45-degree pitch cones. The two chosen input speeds illustrate the relationship; they are not prescribed by Brown.

504 now has one continuous 20-tooth intermediate wheel B, rather than four different visible working rows. Fixed 20-tooth A meshes with B; B drives the 21-, 20-, and 19-tooth wheels E, F, and G on their common loose journal. A is level with F, with E above and G below, as in the engraving. Per carrier revolution E turns +1/21 revolution, F holds its world orientation, and G turns −1/19 revolution. No output is accelerated independently. Face marks and a painted tooth on each output show orientation without adding protruding contact geometry. Playback uses a minimum 12-second nominal cycle.

## Actual profiles and mechanical fits

503 uses the existing conical back-cone involute geometry, not flat spur teeth on a cone-shaped body. Its common-apex transforms and phase are retained. The three loose hubs are shortened to clear the central carrier sleeve; the planet journal reaches the shortened outer carrier head. Source-facing framing exposes the three bevel wheels and the carrier without the former extended hub intersections.

For 504, all wheels have reference module 0.0775, a common 20-degree reference pressure angle and equal base pitch 0.2287901861. B has one constant section throughout its 0.83 depth. At the fixed 1.55 center distance, the different output tooth counts require different working pressure angles and tooth thicknesses; their base radii still share the same module. The output thicknesses are solved from involute working-circle thickness and a 0.0012 backlash target. Their common 0.8375 tip radius trims the active profiles before below-base interference; root radius is 0.655. This is an inferred compatible tooth system, not a recovered historical cutter specification.

| Mesh | Working pressure angle, radians | Transverse contact ratio |
| --- | ---: | ---: |
| A–B | 0.349066 | 1.298180 |
| B–E, 21 teeth | 0.272188 | 1.479312 |
| B–F, 20 teeth | 0.349066 | 1.298180 |
| B–G, 19 teeth | 0.412303 | 1.155731 |

The stationary stud reaches A, the output journal reaches the complete output stack and carrier, and the intermediate sleeve has its actual pin clearance. The bored central carrier pivot is raised clear of its pedestal. All rendered materials disable fog; ground is hidden.

## Bounded validation

`node scripts/review-503-504-contact-solids.mjs` writes `validation/503-504-contact-solids.json`. It samples actual rendered bodies and teeth bidirectionally at vertices, edge midpoints and triangle centers over 33 poses spanning a carrier-relative working tooth period. It checks both containment and nearest-surface distance, so clearance cannot pass solely by separating the gears. The report hashes its production geometry dependencies.

- 503: 409,058 surface queries, zero sampled penetrations; maximum closest-surface gap 0.003011. The back-cone approximation gives contact ratio 1.638936.
- 504: 852,549 surface queries, zero sampled penetrations. Maximum closest-surface gaps are 0.000582 for A–B and B–F, 0.000600 for B–E, and 0.000596 for B–G.
- Focused tests also check actual 503 hub/sleeve/head surfaces through a full carrier turn, 504 pivot/pedestal surfaces through a full orbit, journal reach, common apex/base pitch, active contact ratios, source layer order, exact motion ratios and continuous playback.

Command: `node --test tests/movement-503.test.mjs tests/movement-504.test.mjs tests/epicyclic-family-clearance.test.mjs tests/epicyclic-503-504-contact.test.mjs` — 24 tests.

Default, front and advanced-phase browser captures produced no browser errors. Before the final material-only painted indices, 503 rendered 174 calls/26,488 triangles and 504 rendered 68 calls/106,904 triangles, including shadows. Bulk captures remain outside Git under `/dev/shm`.

## Remaining limits

This is prescribed kinematic playback, not a loaded gear-contact simulation. Sampled finite surfaces provide bounded evidence, not a continuous collision proof or a load/backlash calculation. 503 uses a Tredgold back-cone approximation, not an exact spherical involute. 504 root connections are radial extensions rather than generated cutter fillets; its active flanks remain above both base circles. Historical profiles and clearances are unspecified, and the inferred dimensions should not be treated as manufacturing drawings.

504 fits its complete eccentric carrier orbit, which leaves more empty space at its initial pose than a cropped static engraving. Its middle and lower face marks can be hidden by the stack; painted edge teeth provide another orientation cue. The complete 399-carrier-turn output closure is not sped up separately. The review does not exhaustively qualify every support pair under load.
