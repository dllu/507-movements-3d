# Compound epicyclic trains: 506–507

The support, shaft-length and initial-pose residuals below are superseded by the
[pass 47 source/support correction](compound-epicyclic-source-support-review.md).
Its review retains the working tooth geometry and ratios documented here.

Source captions and engravings: [506](https://507movements.com/mm_506.html) and
[507](https://507movements.com/mm_507.html), checked 2026-09-15. Neither page has
an available animation. 506's tooth counts remain inferred; 507 explicitly gives
10, 100, 10, 61, 49, 41 and 51 teeth and the 25,000:1 reduction. Existing signed
carrier-frame arithmetic is retained. No output is independently accelerated.

## Corrected working geometry

506 formerly used the same bevel depth for all eight unequal wheels. That made
the actual cone angles incompatible with their intended common apices even
though its analytic pitch-point diagnostics passed. Each pair now uses a cone
angle derived from its tooth ratio, complementary mating cone angles, and one
actual common apex. Conical heels/toes and involute flanks reuse the shared
back-cone approximation. Face width is 20% of cone distance; working tooth depth
is 1.8 module and tooth-thickness factor is 0.93. These are reconstruction
choices. The fixed input pairs and the inner compound require corrected mounting
phases; those are explicit offsets in the tooth geometry, preserving each rigid
compound and the original continuous angular equations.

507's 100 rectangular crown teeth are replaced by the same conical involute
construction, with an 84.289-degree wheel cone and 5.711-degree pinion cones.
The wheel/pinion ratio remains 100:10. Its high-count spur pairs receive matched
full-depth involute working profiles with a common base pitch within each layer.
Their prior shallow teeth hid incorrect compound mounting phases; both carried
gears now have the required explicit tooth-index offset. The spur layers keep
different modules, as required by the different tooth-count sums and one carrier
pin spacing. There is no expensive cutting sweep or physics initialization in
the browser.

Independent sleeves, gear bodies and hubs now have actual bores. 507's nested
sleeves were made thin enough to fit the ten-tooth pinions: fixed shaft radius
0.105, inner sleeve outer radius 0.135, outer sleeve outer radius 0.165, with
0.001 radial journal allowances. 506's added offset carrier bar passed through
its planet disks and has been removed; the radial axle carries the compound as
in the source. Ground/fog and floating pitch dots/letter plaques are disabled.
506's base is narrower and its input-bearing pedestal now reaches the base.
507's output bearing is aligned with its shaft; the long white output index is
attached to a wheel spoke. The display note explains the true output rate:
0.0144 degrees per carrier revolution, about 72.7 hours per output revolution
at the default speed. This is a truthful slow output, not a stopped animation.

## Validation and remaining work

`node --test tests/compound-epicyclic-geometry.test.mjs tests/movement-506.test.mjs tests/movement-507.test.mjs tests/epicyclic-family-clearance.test.mjs`
passes 26 tests. Added checks cover complementary cones/common apices through
motion, actual journal-cylinder clearance through body/hub/sleeve surfaces,
spur engagement ratios and the unchanged 25,000:1 output. The prior 502–505
journal checks remain green after exporting their two reusable bore helpers.

`scripts/review-compound-epicyclic-teeth.mjs` tests actual body/tooth triangles
bidirectionally using vertices, edge midpoints and triangle centers. At 33
carrier poses, 506 has 706,898 surface queries and 507 has 1,629,206, with no
sampled penetration above 1e-6 model units. A second 507 sweep covers an entire
slow bevel tooth period (250 carrier turns), using 1,620,523 queries, also clear.
The report is `docs/validation/506-507-gear-solids.json`. Reproduce the windows
with `POSES=33 node scripts/review-compound-epicyclic-teeth.mjs` and
`IDS=507 POSES=33 SLOW_BEVEL=1 node scripts/review-compound-epicyclic-teeth.mjs`;
default output goes to RAM.

The largest sampled closest-surface gap is 0.00831 for 506's bevel pairs,
0.00426 for 507's bevel pairs, and 0.000154 for 507's spur pairs. These are
small intentional flank clearances, not force-transmitting zero-backlash contact.
Both 507 spur contact ratios exceed 1.3 and their layer base pitches agree.
The bevel profiles remain an approximate back-cone involute construction, not
exact generated octoid flanks; continuous interference freedom and dynamically
resolved backlash are not proved. Journal tests and working-pair audits do not
constitute a complete cross-family assembly collision proof.

Default/front/advanced browser source comparisons have no browser errors,
missing faces or newly clipped motion. Rendered triangle counts including
shadows are 87,752 for 506 and 217,632 for 507. Source residuals remain: 506's
box-built support frame differs from the curved engraving; 507's planet starts
to the right rather than the left, its output shaft is longer, and the visible
spokes in wheel C reconstruct a region shown edge-on in the source. These are
bounded corrections, not a claim of complete source reconstruction.

## Pass 109: 506 arrangement rebuilt to the plate

The user saw 506's bevels interpenetrating (orange and gold wheels through the
blue ring) and a gold tooth fragment showing through the grey disc. Checked
against the plate and caption:

- **Topology is Brown's**, and it was already wired so: A carries a and h;
  a drives b, and b is united with c; h drives g, and g is united with f; the
  arm k-l is fast on m-n and carries the united d and e; c drives d and e
  drives f. Every mesh is between perpendicular axes with a common apex.
- **The arrangement was not.** Brown draws h as the *outer*, larger wheel on
  A (meshing the upper wheel g) and a as the *inner* one (meshing the lower
  wheel b). The old counts (b 40 > g 32) put a at x = -r_b = -2.0, outside h at
  -1.6, so h's lower half ran through b's teeth, and its teeth broke through
  g's back (the stray fragment). On the carrier, d is outer (on c) and e inner
  (on f), which the old counts did satisfy.
- **New counts** (Brown gives none): a 20, b 36, c 21, d 16, e 10, f 13,
  g 43, h 34, module 0.10, apex of the carried train at y 0.35. They satisfy:
  r_g - r_b = 0.35, so h passes outside b's rim; r_a < r_h; h's face is the
  outer 14% of its cone so its toe clears a's heel by 0.05; c's rim stays
  inside a's toe; d's top stays under g's toe; d stays outside f's rim; and the
  carried compound's swept radius sqrt(r_c^2 + r_d^2) = 1.32, plus head l
  (x 1.23–1.35), stays inside a's toe radius (1.44) when the arm swings round to
  A's side. Brown's drawing, where l reaches farther out than a's face, would
  collide there; that is the one deliberate departure from his proportions.
- Frame: the standard's top arm and upper bearing stand 0.40 higher over the
  larger g; shaft A ends inside a (x -1.50); the arm's head is shortened.
- Teeth: the shared back-cone tooth (bevel-geometry.js, as 025 and 495) with
  creased-smooth normals (24 flank and 12 tip samples) and 192-sided bodies.
  Mesh phases were fitted by `scripts/fit-506-bevel-phases.mjs` (widest least
  flank gap, no penetration) and are held by the exact rate equations.
- Ratios: b-c -5/9, f-g 34/43, carrier 3083/26961, d-e spin -47411/53922 of
  the driver.

Validation: `IDS=506 node scripts/review-compound-epicyclic-teeth.mjs` (33
poses, 1,142,765 queries, 0 penetrations; flank gaps 0.0083–0.0089). A
full-assembly sweep of every rigid body against every other over one whole
carrier turn (193 poses, rendered surfaces, BVH containment) finds no
interpenetration between moving bodies; `screen-body-intersections` (257
samples) is clear. The phase-fitting script is the reproduction path.
