# Pass-56 lane b review (movements 128–254)

Scope: the pass-56 rotated-view findings for 128–254 (`/dev/shm/audit56/b/findings.json`).
Following the brief, whole-part crops in the default view are not treated as flaws, so the
crop parts of 142, 156, 166, 168, 169, 181, 182, 186 and 229 were left alone. Every change
below was checked in the default view and in at least one rotated view, most at several
phases, on a non-watching dev server (port 44452). Intersections come from
`show-body-intersections --spacing=0.01 --samples=129`. For the IDs the production loader
builds outside the registry (146, 147, 149, 150, 157, 168, 169, 170, 181), a scratch copy
of the screen was run against the production factory with source presentation applied. The
repository screen would otherwise measure the legacy registry model.

## Flawed

**227: jagged sprocket.** The sprocket used to be carved by an offline swept-link raster
(`chain-drive-profiles.js`), which left stair-step notches, bumps and lopsided teeth. It is
now a clean, analytic, regular six-pointed wheel (`cleanSprocketProfile227` in
`chain-drive-working-parts.js`). Each tooth has:

- a straight flat under every flat plate link, 0.0008 inside the plate's lower edge;
- a concave notch that hugs each plate link's round end at the joint (the driving face,
  0.0008 clear);
- concave flanks rising to a sharp point at radius 2.62 (Brown's point is about 1.3× the
  pitch radius).

Each flank leaves the notch 38° round it, and its control point is 0.2 off the axis.

The chain still works with it. A scratch sweep of every rendered link (flat plate and
edge-on loop end bars) over 513 poses per tooth pitch found zero overlap area. The
geometry tests confirm the fit: link/wheel minimum gap 0.00079, and the driving-face gap
stays ≤ 0.00079 with positive work. A new test checks for six tips at the six-fold stations
and exact six-fold symmetry. The generator no longer sweeps 227, and the profiles file was
regenerated for 228/229.

## Stray marks

- **170:** removed the five `bowTick` ink ticks from the bow (`mujoco-crossed-governor/solids.js`).
  Rebaked with `scripts/bake-crossed-governor.mjs` (asset and provenance updated), then
  reran both 170 solid-clearance reviews: unexpected pairs `{}` in both.
- **178:** removed the two raised outline rings from the fixed disk face in the production
  branch. A square rear flange, hidden behind the disk, now carries the fixed guide disk on
  the framing plane.
- **150:** the four cams now share one plain driver colour, so the stack no longer shows
  stepped shade bands. The shaft, whose plain end sits inside the smallest cam, is plain
  steel rather than black, so it no longer reads as a black cap.

## Supports, guides and bearings

- **134:** each rope reel now turns in a two-cheek stand with bored cheeks outside the
  flanges, on a foot level with the drum pedestal's.
- **135:** the valve rods run on whole into fixed bored guides (wall-guide boss, web and
  flange) placed past the stroke. Each boss clears the nut at full stroke, and each rod stays
  engaged at both ends of the stroke. A short shaft bearing flanged to the same framing now
  carries the disk shaft.
- **145:** the ground is one solid with Brown's pit under the wheel, cut in section on the
  wheel's mid-plane, instead of two floating slabs. The slim post behind the wheel now stands
  on the pit floor and carries the wheel shaft. The beam shaft runs back into a small flange
  hidden by the beam hub (the column stays unpresented).
- **146:** the stems run on whole into plain rectangular guides past the stroke, each with a
  web and flange (`framed-yoke.js`).
- **149:** the rear bearing bar, rod guides and slides are presented again, and the guides are
  now carried back to the bar by webs and a strap, so the rods end in slides rather than free
  eyes.
- **157:** kept the output guide channel. It is now carried by a flange plate, and the disk
  and bell-crank bearings have flanges on the same rear plane. Only the base, posts and
  back arms are removed.
- **168/169:** both crank shafts now run back into flanged rear bearings. To make room, the
  small crank moves behind the pitman, where its sweep clears the slotted crank or link.
- **172:** the back bar is bolted to the framing by a flange behind the shaft boss and one
  behind the guide frame's closed end.
- **181:** the piston rod is carried whole (a straight extension) through two plain
  rectangular guides past its stroke, each with a web and flange on the engine framing plane.
- **185:** added minimal supports on the sectioned wall:
  - a slide-valve bed that the valve head and gland barrel rest on;
  - a lug carrying the reversing axis;
  - a bearing boss round the output rockshaft, on a bar to a standoff on the wall (Brown
    draws a bracket at the rocker pivot);
  - a flanged rear bearing on the common eccentric shaft.

  The rockshaft and reversing axis were trimmed to stop just proud of their arms (they
  had stood 0.8 out in front).
- **197:** the guide-arc mounts are now a flat bracket at each arc's apex, on a standard that
  stands on the frame plate inside the end member. The standard clears the pinion's furthest
  reach (3.575 from centre) by 0.025, and nothing reaches the frame's short ends.
- **201:** rod A runs on whole through two bored guides with webs and flanges. It stays
  engaged over the full stroke. The old torus bushing is unpresented.
- **219:** the pinion shaft is carried near its outer end by a standard with a bored head on
  its own foot. The arbor is now Brown's long vertical shaft, down to a footstep bearing on a
  foot plate.
- **225:** Brown's bell-shaped lug (a rounded head flaring to a broad foot) carries the floor
  pin, on a plain ground block kept inside the framed view.

## Shapes

- **147:** for display, the baked ramps are replaced by one smooth solid: a plain
  straight-sided trough whose flat rim sits below the arms at every lift, holding a ring of
  two symmetric humps. Each hump's working flank is exactly the baked ramp over the whole
  range the rollers use (a ∈ [−0.84, −0.2]). Its back flank mirrors the ramp about the crest
  at a = −1, where no roller reaches, so the baked motion is unchanged. The fine streaking
  from 320 faceted convex cells is gone. Tested: the rollers stay on the working flank, the
  hump equals the ramp there to 1e-12, and the rim stays below the lowest arm.
- **219:** the wheel is now an open toothed rim with one broad cross-bar through the arbor
  boss, rim to rim, instead of a solid slotted disc.
- **229:** the swept blank is now a regular 14-gon whose flats lie 0.001 inside the plates'
  lower edges. The profile therefore has straight flats and sharp swept notches instead of
  scalloped lobes. The finite-clearance and driving tests still pass: plate/wheel 0.00054.
- **236:** the pawls' round toes no longer jut into the air. The pawl tip is carried back as a
  solid crank from the pawl's rear face to just in front of the wheel face. Studs with flanges
  now carry fulcrum a and the wheel arbor.
- **238:** the pallet blocks are deeper behind their working faces (B 0.16; C tapering from
  0.16 at the root to the original 0.06 at the tip, the most the wheel allows). Each block is
  joined to the anchor by a broad convex web instead of a thin nib, so C reads as the anchor's
  hooked end.
- **240:** the spring is a flat leaf of Brown's width (0.30 broad, widening to about 0.46 at
  its anchored root, 0.05 thick) instead of a nearly round wire.
- **241:** the single tooth is now Brown's broad curled tadpole: a round head bored over the
  arbor, sweeping out into the unchanged working tip, in a darker shade of the disk colour.
- **186:** the spring-handle loop no longer crosses its own band. It is a narrow U whose
  return leg rises outside the diagonal bar and turns into the tongue. The rest-shape
  landmarks (loop bottom near Brown's 455,490) and the motion tests still pass.

## Rope

- **251:** the hoisting line is now the shared laid rope (blue, radius 0.12), whole: up over a
  sheave carried in two cheeks on the top tie, back to a winding drum beside it, and coiled
  three turns on the barrel. The sheave and drum turn with the rope, and the lay travels with
  the hanging length.

## Intersections (after, 0.01 spacing, 129 poses unless noted)

Invisible camera-envelope rows are omitted.

| ID | Result after the changes |
|---|---|
| 134 | clear (33 poses: the laid-rope scene exceeds 8 GB at 129); only the pre-existing open front face of the input shaft |
| 135, 145, 146, 157, 168, 169, 170, 172, 181, 186, 197, 201, 219, 225, 227, 229, 236, 240 | clear |
| 147 | seated roller contact 0.0001 (the displayed ring keeps the rollers within 0.00025 of the baked surface; the first 192-segment ring read 0.0021, so it now uses 720) |
| 149 | seated cam/roller contact 0.0002 only. A first lower-guide web crossed the cams' swept disc (0.070); it now drops below the disc before running back |
| 150 | clear. Fixed a 0.030 guide-bracket/lower-pin-retainer overlap: the bracket now has an open slot along the retainer's stroke |
| 178 | the new flange is clear. The 0.0647 and 0.0340 coaxial rows between the connecting-rod beam and its two eyes are pre-existing and untouched |
| 185 | the new supports are clear. A first rockshaft boss behind the rod pin read 0.0112; it moved to the free layer in front, and the rockshaft was shortened behind it. The remaining joint rows (pins in unbored eyes, up to 0.094) are pre-existing and untouched |
| 238, 241, 251 | zero-depth working contacts only. 251's first winch had rotating parts on fixed axles and a drum flange in the tie; the axles now turn in bored cheeks and the winch is raised |

The screens for 146, 147, 149, 150, 157, 168, 169, 170 and 181 used the production factory
(the registry model differs).

## Tests run (all pass)

`chain-drive-working-parts` (with a new clean-sprocket test), `movement-{172,178,181,185,186,197,201,219,225,227,228,229,236,238,240,241,251}`,
`framed-yoke`, `pinned-elbow`, `twin-cam-{baked,physics}`, `selectable-cam-{valve,physics}`,
`fan-governor-{baked,output,slot}` (with a new trough test), `crossed-governor-baked`,
`diagonal-catch-{assembly,baked}`, `gab-joint-solids`, `linked-variable-crank-motion`,
`variable-radius-crank-motion`, `mangle-contact`, `mangle-rack-working-contact`,
`reuleaux-{bearing-support,valve-clearance,yoke-hardware}`, `rope-drum-hardware`,
`carrier-pawl-225-contact`, `alternating-pawl-236-contact`, `seven-tooth-238-{contact,working-parts}`,
`ratchet-stop-240-working-parts`, `single-tooth-241-contact`, `source-presentation`, and the
`models.test.mjs` blocks for 134, 135, 145, 146, 147, 149, 150, 157, 168, 169 and 170.

## Residuals

- 146: the front bearing that carries the disk shaft (in front, clear of the rear yoke) still
  has no drawn mounting. An arm across the disk face would contradict the plate.
- 185: the rockshaft boss is tied to the common shaft's front bearing by a straight bar that
  reads in the default view (Brown draws a horizontal line from the rocker bracket).
- 197: seen from far to the side, the guide-arc brackets stand forward of the plate, as
  their mounting requires.
- 219: the plate's pinion shaft runs far off to the upper right. The model's shaft is short,
  and its support standard shows in the default view.
- 229: the notches are the swept clearance cuts, trapezoidal rather than Brown's one-sided
  ratchet notches.
- 238: B's neighbouring edge is still the traced outline.
- 135, 146, 172, 178, 181, 201, 236: the supports are the family's flanges on framing
  behind the mechanism. The framing itself is not modelled.
