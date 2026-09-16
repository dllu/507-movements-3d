# Well buckets 457–458: working rope and support interfaces

Sources: [457](https://507movements.com/mm_457.html) and
[458](https://507movements.com/mm_458.html), captions and engravings.
457 has no official animation. 458 has an active canvas model; its opposing
bucket travel and normalized exchange/dwell fractions (0, .4, .5, .9) agree
with the retained schedule. Its pulley turn command is approximate, so the
reconstruction retains the mechanically exact displacement/radius rotation law.
Quintic easing, absolute periods and fluid transfer are reconstruction choices.

457's elevated sweep now follows the engraving's roughly 42-degree inclination.
The rope terminates at the bail rather than continuing through the handle to the
bucket mouth. The working timber has actual bores at its fulcrum and tip; two
bored fork cheeks support its fixed transverse axle. A short tapered post joins
the fork to the ground-level plate. The well mouth and finite wall clear the
entire bucket rim throughout the swing. The well extends below this plate so the
bucket can descend without passing through the viewer ground. The counterweight
still has the captioned half-full-load equivalent moment; an operator's action
remains prescribed rather than inferred from an unforced mechanism.

458's sheave has a real round rope groove, a bored hub and separated support
hanger. The upper rope arc and both vertical legs clear the finite sheave and
spokes through its complete rotation. Roof posts now join the banks and rafters,
and the axle hanger reaches the roof. Finite open well walls replace the solid
transparent block around the buckets.

Both models reuse one finite tapered bucket helper. It supplies a closed floor,
an open mouth and a connected handle. Persistent water geometry fits inside the
wall and floor. Exact frustum-volume integration determines its height from the
prescribed fill fraction; the rendered triangulated volumes agree within 0.004
of full capacity. The well-water levels cover the low bucket mouths during
filling. Fog and the viewer ground are disabled. The reviewed 8/7.5-second
periods survive the production display wrapper.

Validation:

```
node --test tests/movement-457.test.mjs tests/movement-458.test.mjs tests/well-bucket-interfaces.test.mjs
```

The selected finite surface checks span 65 poses and cover rope/sheave surfaces,
axle bores, sweep/fork clearance, bucket/well interfaces and water containment.
They also check submerged filling, bail endpoints, rendered water fractions and
stable scene/geometry identities. They are sampled regressions, not an exhaustive
collision proof. The existing analytical rope-length, opposing travel, no-slip
and quasistatic counterbalance tests remain.

Rope tension, friction, bucket pendulum motion, operator dynamics, tipping to
empty, slosh and water transfer are not solved. The stationary upright bucket
and scheduled fill/empty dwells remain explicit illustrations. The larger well
cutaway, timber section, supports, bores and depth dimensions are inferred. No
MuJoCo bake is claimed for these prescribed, analytically determined paths.

All 24 focused tests pass. Serialized default/oblique Chrome captures have no
page errors; full-cycle maximum absolute NDC coordinates are .888/.890. Render
counts including shadows are 38/67 calls and 31,336/47,848 triangles. Full-cycle
bounds include the below-ground bucket travel; the cutaway is consequently
larger than the static engraving's ground-level view. Bulk artifacts remain in
`/dev/shm/well20-*`.
