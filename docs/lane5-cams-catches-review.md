# Lane 5 review: cams 137–138, stud reverser 153, quadrant catches 183–184, gab disengagers 186–189

Date: 2026-09-23. Scope: bounded source-fidelity and intersection fixes. Each
movement was captured on the production route (`async-engine.js` plus
`model-loader.js`, with source presentation) and compared with its plate. The
intersection numbers use the relative-motion screen
(`scripts/screen-body-intersections.mjs` logic) at spacing 0.01 and 129 samples.
Production baked bundles (137, 138, 153) were screened by loading the bundle
itself over its settled loop and over its recorded startup. The stock screen
only reads the synchronous registry models. These results are sampled triage
evidence, not continuous collision proof.

## 137 — expansion eccentric (baked)

- The undrawn rear mounting plate and rear bearing rings were removed from
  `mujoco-expansion-eccentric/geometry.js`.
- Brown's right-hand eye and hanging rod were added as a fixed support: an eye
  ring with a pin in front of the fork arm, a socket, a band and a tapered stem
  broken off below. The fork pivots in the eye.
- The valve rod now has the plate's parallel strap, shoulder and narrower
  slotted rod.
- The asset was rebaked from the existing, hash-verified
  `/dev/shm/137-fine.json` recording. Motion, loop seam (0.00167 px) and
  penetration (0.0725 px) are unchanged. The new geometry and provenance hashes
  are recorded.
- Production screen: the loop and startup both show only the working
  cam/roller contact (≤0.0004) and 0.005 pin-in-bore coaxial clearance.
  Sampled clear. The synchronous registry model in `authored-cams.js` is
  unchanged. It still has 0.18 fork-boss coaxial overlap and a 0.15
  eccentric/bow overlap, but only offline reviews use it.
- Residuals: the cam's hidden arcs, the 12-pixel outward roller shift, and the
  support's depth and stem are inferred. The shaft is drawn plain rather than
  hatched and keyed.

## 138 — variable cam (baked), no change

The baked production visual matches the plate: carrier disk, three-lobed cam,
point follower and two bolted guides. The production screen finds only the
working point contact (≤0.0001) over the loop and startup, so it is sampled
clear. The 0.093 "resting point enters the cam edge" belongs to the synchronous
model only. That model was left unchanged because the 138 bake hashes
`authored-cams.js`, and its fine probe report is no longer available for a
rebake. Residuals: a hidden rear post and bearing arms support the guides, and
a small dark key shows on the hub, which the plate does not draw.

## 153 — stud reverser (baked)

- `scripts/bake-stud-reverser.mjs` now strips 15 undrawn fixed meshes before
  merging: the base rail, the four rear posts, and the C-shaped bar guides with
  their posts and standoffs. The shafts and the physical elbow stop remain. The
  native bar guide is an ideal constraint, so motion is unchanged.
- The asset was rebaked. Its sources had drifted, so
  `docs/validation/153-assembly.json` and `153-moving-volumes.json` were
  regenerated first; only the `solid-surface.mjs` hash changed, with 0 failing
  pairs. `153-baked-assembly.json` was refreshed with 0 failing pairs.
- Production screen: only working contacts (≤0.0001), so it is sampled clear.
  The framing is now tighter because the rail no longer sets the bounds.
- Residuals: the stepped arm relief, the elbow stop and its bracket, and the
  shaft supports are inferred. The stop shows as a small grey detail below the
  elbow.

## 183–184 — quadrant catches

- The back weights are now drawn as Brown draws them. Each is a broken-end
  vertical rod running from its eye to the plate's lower edge; the 0.46-unit
  weight blocks are hidden. The rods sit just behind their handle eyes, so the
  upper rod passes behind the upper quadrant (the plate dashes it). The eye pins
  end at the rod faces.
- The tappet shoe now seats on the rod section's front face instead of passing
  through it. This removed the 0.090 rod/tappet overlap.
- These edits are in `quadrant-catch-finite-parts.js`, which only 183 and 184
  use.
- Remaining known overlaps come from the unchanged prescribed transfer law:
  - curved arm plate / tappet: 0.2225
  - working tip / tappet: 0.18
  - retaining pin / quadrant band or arm: 0.12 and 0.10
  - lower weight arm / tappet: 0.029
- Also still unresolved: the quadrant rims are about twice the plate's
  thickness (the lower band is 0.58 units against the plate's ~0.31), and the
  webs are plain annular sectors rather than cast shapes.

## 186–189 — gab disengagers

Shared changes:
- The initial camera is now a near-true elevation: [0.03, 0.02, 1], replacing
  [0.2, 0.15, 1].
- White indices and contact spheres became invisible anchors.
- Tube-built parts were replaced by plate-traced flat plates (new
  `sourcePlate`) and flat straps (new `makeFlatStrap`).
- Each rod is one plate: the broken bar, the round or raised crown the plate
  draws about the gab, and the gab slot cut up from the rod's lower edge. The
  rectangular U-frames are gone.
- Pins now end at the faces they join.

186:
- The source anchors were re-measured. The cam lever now pivots on the plate's
  "c" pin (341, 242) instead of 35 px above it. The pin is 19 px, and the rocker
  has the drawn lower boss behind the rod.
- The lever is a traced hook, arm and forked head. Its toe is carried on a
  hidden rear cheek, the plate's dashed lobe, behind the rod and crown, which
  removes the old toe-neck/crown clash.
- The shoulder is shortened to its sampled toe travel.
- The spring handle is a flat strap along the plate's loop. Its free end
  passes behind the strap into notch a, cut as a square mouth that faces the
  arriving tip.

187:
- The upper handle is traced and lies behind the rod crown, as the plate
  shows. Its toe sits on its rear face.
- The lower handle is part of the rod plate.
- The rockshaft and boss end behind the handle plane.

188:
- The loop is a flat strap along the traced plate path (rising from the
  bean-shaped boss up the diagonal, around the loop and down to notch a).
- The cam boss and back are a plate behind the rod (the plate dashes them).
- The conjugate working rail is offset by its own radius, so its inner
  surface is the profile.
- The leaf spring is a flat strap behind the loop's diagonal. It flexes
  backward, away from the loop. A notch tab reaches into the spring plane.
- The valve-pin carrier tongue is hidden.

189:
- The rod plate includes its forked end, crown, tail and hanger eye.
- The hanging link lies behind the rod and crank eyes (the plate draws both
  eyes whole).
- The shaft and boss end behind the rod.

Screens (before → after, worst non-fluid pair):
- 186: 0.104 spring/root, plus 0.023 pin/crown → none (sampled clear).
- 187: 0.096 cam/marker, plus 0.089 pin/crown → none.
- 188: 0.119 cam/pivot and 0.109 pin/cam back, plus spring pairs → none. The
  rail is an open tube, so only rail→pin is checked.
- 189: 0.104 boss/crown → none.
- `docs/validation/186-187-cam-solids.json` was regenerated with no
  intersections.

Remaining limits:
- The kinematic laws are unchanged apart from 188's leaf-flex sign.
- 186 and 187 still use hidden shoulder contacts. In 186 the shoulder shows as
  a short ledge left of the rocker arm.
- In 188 the conjugate rail hangs below the rod at the engaged pose. The
  plate's dashed working edge lies above the pin, so the handle sense (the loop
  swings down) is inferred.
- 188's spring root was moved into the rod silhouette, below the loop's sweep.
  The plate's screw head is not modeled.
- Spring deformation is an interpolated bend, not an elastic model.
- The outlines are hand-traced at pixel scale.

## Tests

The following pass:

- `tests/movement-183.test.mjs`, `movement-184` and `movement-186` through
  `movement-189`
- `gab-cam-contact`, `gab-joint-solids` and `quadrant-catch-finite-interfaces`
- `expansion-eccentric-{bake,profile}`, `stud-reverser-{baked,physics}` and
  `variable-cam-{bake,prototype}`
- `source-presentation`
- `models.test.mjs`, filtered to 137, 138, 153 and 183–189

Pinned numbers were updated only where a source re-measurement or layering
change moved them. Examples: raster anchors, strap child counts, envelope
depths for the thinner pin stacks, and 188's released cam gap for the larger
pin. The pre-existing 137 synchronous test failure was repaired to read the
bored rollers' recorded radius.
