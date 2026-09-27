# Pass 69, lane w2: pumps and rams (444–456, except 447)

Close review of function, seals and water for 444, 445, 446, 448, 449, 450, 451, 452, 453, 454, 455 and 456.
Captures are in `/dev/shm/p69-w2/` (not in Git):

- `before/`: the starting state.
- `after/ID-default.png` and `after/ID-oblique.png`: render beside the plate (review script).
- `after/phases-ID.png`: default view at phases 0, 0.25, 0.5 and 0.75 (fluid states).
- `a455/t.png`: 455 at six rotor phases. `a455/v.png`: 455 in the default, ±60°, top, back and oblique views.
- `a446/z.png`: 446 at eight phases (continuous water).
- `a448/t.png`: 448 at eight phases across the upstroke.
- `a452/t.png`: 452 at four phases, default and oblique.

`water-stream.js` (lane p69-water) was used unchanged for streams in pipes, spouts and falls.
`cutaway-presentations.js` changed only in the 445 entry (the new water role).

## 455 Old rotary pump (user finding: leaky hexagon)

**How it works.** A hollow drum turns clockwise inside the outer cylinder. It is a mutilated cylinder: two opposite
chordal flats. Each flat carries a hinged valve whose back is an arc of the drum's radius. Away from the lower-right
projection, each valve swings out until its edge bears on the bore. The valves then sweep water from the lower
entrance, round the left and top, to the upper exit. The projection (abutment) folds each valve into its flat. The
closed valve and the drum then form a whole cylinder, which passes the abutment with a close running fit.

**What was wrong.**
- The drum was a hollow hexagon (an octagonal cylinder beneath it), so it could not seal against the abutment.
- The valves were straight leaves with a bellied profile and separate lip pieces.
- The valves followed a baked contact table with a prescribed hold and return.
- The abutment was a separate brass block.

**What changed.** `authored-old-rotary-pumps.js` was rewritten.
- **Drum.** A mutilated hollow drum: radius 1.33 (0.565 of the bore, as drawn) with two 52° flats. The wall stays
  0.18 thick under the flats.
- **Valves.** Each valve is a circular segment with a drum-radius back and a rounded knuckle heel, tangent inside the
  drum. The recess is the valve outline plus 0.006 running clearance. Folded home, the valves complete the cylinder.
  A test probes the full circle for this.
- **Opening law.** Each valve opens as far as the chamber allows: edge on the bore (0.004 clearance), then on the
  abutment top, then folded home past the corner. This is tabulated per half degree, once per process.
- **Reopening.** After the corner, the valve reopens over 40° of rotation with a quintic ease, rather than flying open.
- **Abutment.** Brown's square projection is now part of the casting. Its upright face is flush with the entrance
  bore, and its corner runs 0.006 off the drum.
- **Ports.** Round port pipes enter through square middle-layer holes (the shared `portedCasingGeometry`).
- **Water.**
  - The annulus is always full.
  - The recess behind each open valve holds water. That recess water is an in-place buffer: the recess clipped by the
    valve's straight face. A test checks that the recess water plus the valve inside it always fills the recess
    (volume conserved).
  - The pipes carry streaming water.
- **Removed.**
  - Old helpers: `old-pump-vane-geometry.js`, `old-pump-contact-profile.js`, `scripts/generate-old-pump-contact.mjs`,
    the 455 code in `rotary-pump-contact.js`, and `tests/old-pump-455-contact.test.mjs`.
  - Undrawn parts: the foundation, feet and white index are no longer built, and the presentation `remove` list is gone.

**Checks.** Intersections before: none among solids. After: none among solids (clean). Faces: 2 degenerate (the
padding of the fixed-size recess-water buffer, drawn with a draw range). Loop seam: clean.

**Residual.** Brown draws the flats about 65° wide but the valves shorter than the flats. At 52° one segment both fills
its flat and reaches the bore, so it opens about 22° from radial. A 4° relief groove just ahead of each knuckle clears
the heel's swing, which is a small momentary leak path as it passes the corner.

## 456 Cary's rotary pump

**How it works.** Drum B turns clockwise about the fixed heart cam a. The rigid bar c-c slides so that one end is
retracted at E while the other end sweeps the crescent chamber from L round the top to M.

**What was wrong.**
- No water was shown anywhere; the chamber read as a dark void.
- Seals were checked as correct: the wall is the envelope of the bar ends plus 0.003 clearance, and the drum meets the
  wall at E with 0.003 clearance.

**What changed.**
- The crescent chamber is filled with water (the wall envelope minus the drum and packing E).
- Suction F carries a streaming column into L.
- Discharge H is one stream from the throat at M, round the gooseneck, which then falls from the spout (Brown's
  downward arrow).
- Streams stop short of the swept pistons.

**Checks.** Intersections: solids unchanged. The roller-on-cam contact (0.0000) is by design. The only fluid overlaps
are pistons immersed in the chamber water. Loop seam clean; faces clean.

## 444 Montgolfier's hydraulic ram

**How it works.**
1. The head box feeds the drive pipe.
2. The weighted waste valve is open, so the current accelerates and escapes.
3. The current closes the waste valve. The hammer then lifts the delivery check into the air vessel.
4. The compressed air drives a steady jet up the riser.
5. The waste valve reopens, and the cycle repeats.

**What was wrong.**
- The vessel water was a cylinder poking out through the globe.
- A translucent yellow "air" sphere was drawn.
- The riser was dry between its mouth and the jet.
- The drive pipe ran past the neck with no opening into it, and passed through a ported ring at the waste valve. There
  was no real passage to either valve.
- The head box had no supply.
- The tail water was a strip behind the ram only.
- The waste efflux popped on and off.

**What changed.**
- **Vessel.** The globe is drawn in section (back half, cut on the drawing plane), like the head box and tank. Its
  water is a sectioned spherical segment whose level follows the existing mass-balanced water volume (tested).
- **Air.** The air is not drawn.
- **Ram body.** A closed ram-body box under the vessel receives the drive pipe. Its top is pierced under the neck
  (delivery check) and under the waste seat. The neck is sectioned so the delivery disk shows.
- **Riser.** The riser runs full to the jet.
- **Supply.** An inclined trough pours into the head box (Brown's chute).
- **Tail water.** It fills the sectioned tank.
- **Streams.**
  - The drive-pipe streaks advance with the prescribed drive current.
  - The waste efflux thins and fades with the valve opening. The loop-seam check now finds no pop.

**Checks.** Intersections: the only solid pair is the seated waste disk against its seat (0.0000 contact). Fluid pairs
are immersed valves. Seam clean.

**Residual.** The tail-water box also fills the closed ram body and neck (a double tint inside the sectioned neck).
The tank has no drawn outflow to hold its level.

## 445 / 446 D'Ectot's oscillating column

**How it works.**
- Water falls from the upper orifice onto the fixed plate and spills from its rim into the lower box.
- A cone builds on the plate and checks the orifice.
- The column in the upper tube rises until the cone gives way.

**What was wrong.** The falling stream, cone, crown, rising column, film and sheet were six separate translucent
pieces:
- A flared stream foot sat on a thin column, giving discs and gaps between the pieces.
- The column overlapped the box water.

**What changed.**
- **One water body.** All six pieces are now ONE revolved water body, rewritten in place each frame. At each height
  its radius is the widest of stream, column and cone there. It runs continuously over the plate and down the sheet,
  whose thickness follows the discharge.
- **Inside the full upper box** the column is not drawn; its heave shows only as the crown at the surface.
- **The load-time lathe crease pass** is disabled for this one geometry (it re-grids lathes and scrambled the in-place
  writes).
- **The 445 cutaway entry** lists the new role.

**Checks.** Intersections: no solid pairs. The fluid-to-wall clearance test now runs on the unified body and passes.
Seam clean. The face flags (sectionCover of the conduit roof on the clip plane, and the plume's mixed winding) predate
this pass.

## 448 Common lift pump

**How it works.**
- **Upstroke:** the foot valve opens and the bucket valve shuts. The water above the bucket is lifted and runs from
  the spout.
- **Downstroke:** the bucket valve opens, and water passes through the bucket.

**Verified.**
- The valves seat.
- The volumes balance: dV_lower = Q_in − Q_transfer, and dV_upper = Q_transfer − Q_out, at a constant spout level.

**What was wrong.** The spout discharge snapped between hidden and 45 per cent size at each end of the upstroke.

**What changed.**
- One WaterStream runs through the spout and falls ballistically from the lip.
- Its section follows the discharge, and it fades near zero flow. The seam check is now clean.

**Residual.** Brown's wider pump head (cistern) is still drawn as the plain barrel.

## 449 Modern lifting pump

Reviewed with no change. The stuffing box, the bucket and foot checks, and the upward delivery flap follow the stroke.
The barrel and delivery bulb run full. **Residual:** Brown's lower check is a hinged flap; it is drawn as a lifting disk.

## 450 / 451 Force pump, with air chamber

Reviewed with no change.
- The solid piston fits the bore.
- The suction check opens on the upstroke and the outlet check on the downstroke.
- The delivery column is full.
- 451's air-chamber level rises on the downstroke and falls on the upstroke.

**451 residual:** the unused central outlet carries a small cap that Brown does not draw.

## 452 Double-acting pump

**How it works.**
- **Downstroke:** suction 1 admits water above the piston, and discharge 3 sends the water below it to B.
- **Upstroke:** suction 2 and discharge 4 serve the opposite chambers.

**What was wrong.**
- No water at all.
- The piston and flaps were 0.53 deep in a 0.62-deep section, leaving a bypass round the piston.
- The flaps hung in their ports with nothing to seat against on the reverse-flow side, so they could not check.

**What changed.**
- The piston and flaps fill the section depth (0.006 clearance).
- A seat lip on the right of each flap's free end (all four open to the left) closes the port. Brown's round stops on
  the left limit the opening.
- The passages A and B and the valve ports are one fixed water body. The upper and lower chambers follow the piston.

**Checks.** Intersections: no solid pairs. Fluid pairs are the immersed flaps, rod and piston nut. Faces clean. Seam
clean.

## 453 / 454 Lantern-bellows and diaphragm pumps

Reviewed at zoom.
- The four checks of 453 and the two of 454 seat on their rings.
- The bellows and the diaphragm chamber stay full, and the timing matches the strokes. No change.

**453 residuals:**
- The chest and suction bend are 3D tubes rather than Brown's flat box and semicircular channel.
- The beam post is not drawn.

## Proposed ledger text

| ID | assessment | visibleFlaws | limits |
|---|---|---|---|
| 444 | minor | The ram body, trough and head box are simplified boxes; the tail water also tints the inside of the sectioned neck. | Valve timing, hammer pressure and air compression are prescribed (mass-balanced); no tank outflow is drawn. |
| 445 | reasonable | | Stream, cone, column and sheet are one prescribed revolved envelope; pressure recovery and breakup are not solved. |
| 446 | reasonable | | As 445; the rising column inside the full upper box is shown only by its surface crown. |
| 448 | minor | Brown's wider pump head is drawn as the plain barrel. | Primed incompressible volume model; check lifts prescribed. |
| 449 | minor | The lower check is a lifting disk where Brown draws a hinged flap. | Primed incompressible volume model; check lifts prescribed. |
| 450 | reasonable | | Primed incompressible volume model; check lifts prescribed. |
| 451 | minor | A small cap closes the unused central outlet, which Brown leaves open. | Air cushion is isothermal and prescribed; air not drawn. |
| 452 | reasonable | | Flap swings prescribed; the water is a planar section of fixed depth. |
| 453 | minor | The valve chest and suction bend are 3D tubes rather than Brown's flat chest and semicircular channel; the beam post is not drawn. | Bellows water and check timing prescribed. |
| 454 | reasonable | | Diaphragm shape and check timing prescribed. |
| 455 | reasonable | A 4° relief groove beside each valve knuckle is a small leak path as it passes the abutment corner. | Valve opening is the chamber-limited envelope (tabulated), reopening eased over 40°; water pressure and slip are not solved. Flats 52° (Brown about 65°) so one valve fills its flat and reaches the bore. |
| 456 | reasonable | | Cam contact kinematic; chamber and pipes shown full at a steady rate. |

MuJoCo: none of these uses production MuJoCo; all are authored analytic playback.
