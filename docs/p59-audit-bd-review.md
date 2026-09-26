# Pass 59 audit fixes, lanes b and d (p59-audit-bd)

Findings came from `/dev/shm/audit59/b/findings.json` (128–254) and
`/dev/shm/audit59/d/findings.json` (382–507). Every fix below was checked in
fresh captures from a restarted, non-watching dev server on port 44504. Each
capture is the default view plus the ±60° rotations, a back view and, where
needed, close-ups (scratch captures are in `/dev/shm/x4/raw`). Intersections
come from `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=65`
unless a movement has its own review script.

## Flawed

**158 (treadle).** The crank pin moves in along Brown's radial line to 0.28 of
the disk radius, pixel (256,258) instead of (205,295). The treadle now rocks
through 16.3° from level, where it swung ~50° up across the disk face; the rod
length follows from the fixed joint. The white crank-face cap is now brass.
- Assembly review (`review-source-treadle-assembly.mjs`): no failures.
- The oracle comparison was rerun. The canvas oracle still matches the old
  authored-crank route; the engraving pin distance is now reported as 35.8 px.
- Seen in the default and rotp60/rotm60 views at phases 0, .3 and .5.
- Residual: the crank radius deliberately departs from the engraved pin
  position.

**238 (seven-tooth escapement).** The anchor is now one plate as thick as the
pallets. In the wheel's layer it keeps its whole outline except the region the
star's teeth sweep relative to the anchor over a cycle. That region is baked
offline by the new `scripts/bake-seven-tooth-238-sweep.mjs` into
`src/simulation/baked/seven-tooth-238-sweep.js`: 3000 poses, 3% radial growth,
Douglas-Peucker thinned to 3.5k points. B and C now read as faces cut into the
anchor's outline, not blocks stuck onto it.
- Intersections: star × anchor body 0 (a first 600-pose bake gave 0.0225
  before the finer bake); star × B face 0.0000 is the intended lock contact.
- Seen in def0/def5, rotp60/rotm60, back, top and oblique close-ups.

**481 (wet gas meter).**
- Partitions: each is now one extruded hooked sheet that runs in from the
  drum shell on an offset straight line, then spirals 150° round inlet a. This
  gives Brown's pinwheel of hooked chamber mouths and replaces the 13 box
  segments.
- The rear drum head is opaque paper-white with no inlet slots, which were
  the "pale chips".
- The water body (opacity .42, no shadows) now ends just behind the section
  plane, so the cut shows a clear water face across every chamber up to the
  level above the centre.
- The mechanism text now says gas enters through the hooked mouths. The
  working-solids test now checks for a whole rear head.
- Intersections: fluid only (water with partitions and drum, which are
  submerged by design).
- Seen in the default view at phases 0 and .3, and in rotp60, back and
  oblique.

**494 (stone tongs).**
- The stone is now five stacked layers of Brown's outline. Each tong's layer
  has a V-socket (depth 0.085) at its bite seat, and the point apexes sit
  0.05 into the sockets while closed.
- The display clock starts at source phase 0.45 (lifted dwell), so the
  default view shows the stone gripped and lifted. `stateAtTime` keeps the
  canvas phase; `geometry.displayPhaseOffset` is exposed.
- Source presentation removes the white bite-contact dots.
- Intersections: points against the stone are clear in the solid test at
  every pose; the only screen hit is the rope in the shackle ring (0.0017,
  deforming).
- Seen in close-ups of the default and rotp views at phases 0, .5 and .6, and
  in a side view.

## Minor, 128–254

- **181/182:** The upper rocker's horn back plate is now the convex hull of
  the hub and Brown's horn tip, which removes the stepped notch and spike.
  The movement was rebaked (`bake-diagonal-catch.mjs`, keys regenerated) and
  `review-diagonal-catch-assembly.mjs` was rerun: 0 intersections over 129
  poses. Seen in close-ups of def5, the oblique view and rotp60.
- **153/154:** Baked paper-white stud and pin end faces now take the stud
  ink colour (`plainStudEnds`). Seen in def0 plus a zoom.
- **168/169:** Each shaft-bearing flange and the rocker fulcrum block now sits
  on a 0.3 square stay running back to a round flange on a framing wall at
  z −1.6, hidden behind the bearing in the plate view.
  `review-*variable-crank-solids` reports no unexpected intersections. Seen in
  rotp60, rotm60, top and back.
- **196:** Pinion B's axle now runs into a bored frame-colour boss (the old
  loose torus), which a stay carries back to a wall flange. The stay was
  moved behind the shaft end (coaxial 0.067 → none). Seen in rotp60, rotm60
  and back.
- **209:** The forked catch is now one solid flat brass horn: tapered crescent
  tines 22 → 4 px along the old paths, a flat stem and a boss seated on the
  wheel face. The wire tubes and ring are hidden and the pitch-contact dot is
  removed. Intersections: none. Seen in def0/def5 zooms and oblique.
- **226:** Frame A is now one broad flat rectangular plate (band 0.22, 0.08
  thick) in place of four square rails. Intersections: none. Seen in def0,
  the oblique zoom and back.
- **244:** The scale-pan cords are laid rope of radius 0.035 in cord blue.
  Seen in def0, rotp60 and oblique.
- **250:** The "bands" were shadows of the support wheels' thin rims falling
  on the spoked main wheel; no cue is applied there. The main wheel's meshes
  now receive no shadows. Seen in def0/def5 and a zoom.
- **254:** Each fork is one chunky flat Y plate (half-width 0.09, 0.2 thick).
  Intersections: none. Seen in def0, a zoom, rotp60 and oblique.
  Follow-up: the chunkier prongs had widened each fork to 0.72 across,
  outside the engraved forks' width tolerance. The prong centres are now at
  ±0.25 (0.68 across), and the chain seat moved out to radius 2.985 so the
  centred link half-gap stays above 0.1 (0.107).

## Minor, 382–507

- **Rotation cue**, entries in `src/data/rotation-indicators.js`, seen in
  def0, rotp60, back and top:
  - 393: cup shell, polishing face and handwheel.
  - 411: paper drum.
  - 413: rubber-disk flanks, clamping plates, V-groove flanks and hub.
  - 415: rim, web and hub of D.
  - 428: rollers A.
  - 490: guide sheaves.
  - 495: pulley A.
- **492:** The floating hand is gone. The release rope now runs over a fixed
  lead sheave on a stanchion beyond the plate and hangs as a tail with a
  wooden toggle. The rope length is conserved: the tail shortens as the eye
  draws the rope in. The cord leaves the eye heading straight for the sheave.
  The tackle-fall hand is unchanged (not in the finding). Seen in def0/def5,
  rotm60 and a zoom.
- **471:** A frame bar across the back of the loop column now carries crank
  A's bearing, and cylinder B slides between two guide strips on the arms'
  inner faces. Intersections are unchanged apart from existing fluid/pin
  hits. Seen in back at phases .1 and .5, rotp60 and rotm60.
- **469:**
  - The screw barrel is cut as a back half-tube, so the whole helix shows.
  - The water and the cistern back walls take no shadows, which removes the
    blotches.
  - Seen in def0 and a zoom with and without shadows.
- **445/446:** A round walled neck (half-section) joins the upper orifice to
  the lower box opening. Intersections: only existing fluid hits. Seen in
  def0, rotp60, rotm60, back and oblique.
- **436:** The bottom bridge is now an angular trough: lips, straight sloping
  sides, a flat floor and a uniform 0.16 section, and it takes no shadows.
  Seen in def0, zooms and oblique.
- **433:** The spray now leaves the floats' outer ends downstream of the
  strike instead of lining up under the jet. Seen in back, rotm60 and a
  back-view zoom.
- **421:** The speckle was z-fighting, not shadow acne: it stayed with
  shadows off. The stuffing box sat 0.09 into the cylinder head, and both cut
  faces lay on the section plane. The box now stands on the head's top face
  (cutaway `prepare`). Seen in a zoom and def0.

## Tests and reports

Passing:
- `tests/movement-{181,182,196,209,226,238,244,250,254,393,411,413,415,421,428,433,436,445,446,469,471,481,490,492,494,495}.test.mjs`
- `source-treadle`, `gas-meter-working-solids`, `lifting-contact-solids`
- `variable-radius-crank-motion`, `linked-variable-crank-motion`
- `stud-reverser-*`, `weighted-bell-crank-*`, `diagonal-catch-*`
- `rotation-indicator`, `source-presentation`

Updated tests:
- `source-treadle`: new pin and a rock limit.
- `gas-meter-working-solids`: whole rear head.
- `movement-494`: display offset and the removed index.
- `movement-254`: flat Y fork.

Reports rerun:
- `docs/validation/158-assembly.json`
- `158-oracle-comparison.json`
- `168-solid-clearance.json`
- `169-solid-clearance.json`
- `181-bake.json`
- `181-baked-assembly-clearance.json`

Rebaked: `src/simulation/baked/assets/181.json.gz` and
`diagonal-catch-keys.js`.
