# Lane m16-markers: undrawn marks on 47–62 and the orbiting segment of 76

Audit 52 found white wedges on 49's bevel teeth, white index stripes on the
plain pulleys and discs of 52 and 58–62, and 76's rim segment D leaving the
frame for most of its turn (maxNdc ≈ 1.57). Brown draws none of these marks.
Movements 1–23 had already dropped them (`white-index-.*` source-presentation
removals).

## Where the marks came from

They were baked into the factories, so source-presentation patterns could not
remove them:

- **49**: tooth 0 of each of the three bevel gears used `PALETTE.white`
  (`src/simulation/ratchet-bevel.js`). All teeth now use the gear's own colour.
- **Painted pulley stripes**: `turnedClutchGeometry(..., {paintIndex: true})`
  paints a 0.1 rad band of `0xf1ebdc` vertex colour along the outer rim. The
  flag is now gone from these callers: 47 (`friction-clutch.js`), 50 and 51
  (`universal-joint.js` shafts), 52 (`pin-clutch.js` driver disc and shaft),
  59 (`two-speed-selector.js` drum and pulleys) and 60 (`dual-belt-speeds.js`
  pulleys). The helper itself is unchanged because other movements still use
  it.
- **Travelling stitch ticks on the flat belts** of 58, 59, 60, 61 and 62
  (`three-speed-selector.js`, `two-speed-selector.js`, `dual-belt-speeds.js`,
  `held-side-differential.js`, `dual-input-differential.js`). A tick every
  1/12 of the belt length was recoloured every frame. Brown draws the bands
  plain, as do the belts of 1–23. The belts now get a single paper colour once,
  at construction. They keep their `color` attribute, and the per-frame loop
  over 2048-segment belts is gone.

The motion laws, geometry and belt kinematics (`beltDistance` in the state) do
not change.

## Scan of 1–127

I ran a browser scan of every production-route model after
`loadMovementModel` (with source presentation). It listed visible meshes with
index/marker/stripe/tick/arrow/dial roles, light non-vertex-coloured
materials, painted-index geometry (`geometry.userData.paintIndex`), or a
minority of near-white vertex colours. After the changes it finds no painted
index or marker left. The other white or light hits are parts Brown draws:

- 55: backplate in the page colour
- 63: pins
- 73: hatched block
- 77: pin caps that read as the plate's holes
- 86: drive band
- 90, 91: shaft section faces
- 106, 107: hatched header

Hits on `radial…` names only matched "dial" and are not marks.

47 keeps a brass feather key on its shaft. It shows while the sleeve slides.
It is a real working part, not a marker, so I left it.

## 76: orbiting rim segment D

Brown draws only a broken-off piece of the large wheel, which turns on the
ratchet's own axle. Any piece of that wheel therefore sweeps a full circle of
the rim's radius (2.38) about A. A shorter arc would not shrink that sweep, and
the rim and stud radii are fixed by the plate and by the working strike. The
segment stays as drawn. The 'section' view now fits the swept disc
(±driverOuter), the same box as the complete-wheel view. Every other part
already lies inside it: the non-driver bounds over one baked period are
x −1.00…2.33, y −1.00…1.20. The change affects only the display, so nothing
was rebaked. maxNdc goes from ≈1.57 to 0.92, and the whole segment stays in
view at every sampled phase. The cost is a smaller subject at rest: about 62%
of the earlier scale, with empty margin left and below, where the segment
passes later in the turn.

## Captures

Before: `/dev/shm/audit52/a/img/{ID}-*.png`. After:
`/dev/shm/m16/after/{ID}-default.png`, `-p0.25/0.5/0.75.png`, and
`/dev/shm/m16/review`. All were inspected. 49 has no wedges at any phase, and
52 and 58–62 show plain discs and plain belts.
