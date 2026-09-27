# Pass 69 — pawls and escapements lane (389, 396, 402, 412)

Reviewer: Claude Opus 5.5 — p69-pawls lane, 2026-09-26. Each change answers
the user's feedback and was checked against `public/engravings/mm_NNN.png`,
the caption, fresh captures (default, ±60°, top, back and zoomed phases), and
contact sweeps over the cycle. Captures are in `/dev/shm/p69-pawls/`
(`before/`, `after/`, `cap/`) and are not kept in Git.

## 389 — eccentric lifting jack

Feedback: only the pawl tips touched the teeth.

- Rebuilt from the plate at 0.60/35 units per pixel: rack (x 207–243, top
  y 54, bottom y 374), head (a turned frustum, Brown's trapezoid), stepped
  stand walls, and teeth with flat undersides and sloping backs (pitch 16.4 px).
- The working face is now the tooth root (`rackFaceX = rootX`). Both pawls are
  Brown's curved blades traced from the plate (the lifting horn tangent to the
  strap, with its hollow lower edge; the upper stop with its eye). Their noses
  form a 16–22° wedge that fits the 52° notch, so each nose sits in the root
  corner under a tooth's flat face.
- Motion: a rocking eccentric (a hand lever works it over the right half of
  its turn, so the strap never meets the teeth). Each pawl rests on the rack
  profile. Its free swing comes from a pose-by-pose contact continuation
  (`restingContinuation` in `lifting-jack-contact.js`). Each pawl rides up the
  back of a tooth, clicks into the next root, and the click is eased (every
  eased pose is checked clear). The stroke is one pitch, plus the stop's ride
  (0.24), plus the lifting nose's ride (0.23).
- Contact checks: the nose coincides with the root corner at every engaged
  sample (1e-12). The finite pawl, strap and rack solids stay clear over 257
  poses. Travel speed is bounded at two resolutions.
- Honest deviations: the eccentric throw is 20 px against Brown's 14 px, the
  shaft sits 2.6 px right, the noses are sharpened, and the stop sits one pitch
  higher than drawn. With the plate's spacing, the rising horn passes 0.008
  into the stop's eye. The rear guide cheek, which Brown does not draw, is now
  removed.
- Intersections: before, clear (pass 51); after, clear
  (`show-body-intersections 389`: no pairs).

## 396 — Reed's escapement

Feedback: the pin clipped the fork on the downward swing, and the right-hand
escapement had hidden pins and protrusions.

- Lever C now follows roller pin i through the slot of fork e
  (`reed396LeverFromBalance`): an exact slot constraint while the pin is in the
  fork, and on a banking pin otherwise. The pin orbit is 0.5, which carries the
  lever exactly bank to bank (±5°, engagement ±47°). This matches Brown's
  pin-in-notch at about 25 px. The fork is one extruded U: its slot is the
  pin's width plus 0.008, with chamfered horns. The roller is a small boss with
  one arm out to the pin.
- The anchor-like cross-piece h and pallets g and f are one extruded plate in
  the wheel's plane: a bracket round staff c whose arms end in the pallets, as
  drawn. The pallet necks, the raised cross-piece and the separate F mesh are
  gone. Chronometer pallet j and its arm are one plate on staff b, in the same
  plane (its bridge and neck are gone). The pallet stands 0.855 rad behind the
  pin, so it is past the line of centres when f releases.
- The baked contact continuation is regenerated
  (`node scripts/generate-reed-396-contact.mjs`; `--check` passes). G and J
  reactions still assist their coordinates (normal-cone test). J receives
  impulse on 17 knots.
- Contact checks: pin against fork stays clear over 1601 poses (minimum gap
  0.008), and the pin sits on the slot centre whenever the fork is engaged.
- Intersections: before, pin/prong 0.071 on both beats; after, only working
  contacts at 0.0000 (wheel against anchor, wheel against j).

## 402 — Guernsey's escapement

Feedback: the escapement was wrong.

- New `src/simulation/guernsey-anchor.js`. The escape wheel is one plate with
  fifteen forward-leaning teeth. Anchor A is one plate with the pivot boss, a
  curved upper arm to its pointed pallet, and a lower arm to its block pallet,
  in the wheel's plane on lever B. The old tooth heads with rear feet, the web,
  the raised anchor arms and the tube pallets are removed.
- Each pallet has a locking face and an inclined impulse face, and the pallets
  span 2.5 teeth. The upper locking face runs along its own path about the
  pivot (dead-beat). The lower one recoils slightly (at most about 0.03 rad per
  lock).
- The wheel is driven forward and is stopped, pushed back or released only by
  contact. Its angle is stepped through one lever period and baked
  (`node scripts/bake-guernsey-anchor-402.mjs`; `--check`). It advances exactly
  one tooth per period, alternates lock → impulse → drop on each pallet, and
  the drop speed is bounded (2.5 rad/s). The lever and balance timing is
  unchanged (prescribed).
- Intersections: before, 0.0729 (rim against a white index, pass 49); after,
  clear.

## 412 — capstan wheel-work

Feedback: the pawls and the outer wheel had been fused into a rigid band with
no notches.

- The barrel's wheel gets Brown's rim with six notches (at 30° + 60k, as
  measured). Each notch has a steep face and a short ramp, and they alternate
  facing so the two drawn pawls oppose each other.
- The upper pawl and the hooked lower pawl are separate plates. Each is traced
  from the plate and turns on its own eye pin.
- Reading of the caption: the opposed noses lock the barrel to the drumhead
  both ways, which is single purchase. So the pawls ride the drumhead (spindle)
  and are the lock. They lift 0.09 rad clear while the wheel-work turns the
  barrel against the drumhead, and drop back in when the two agree.
- Contact checks: the seated clearance is at most 0.012. Turning the rim ±0.02
  rad drives it into a nose both ways (the lock). Lifted pawls clear the rim by
  more than 0.02 at every compound pose. The pawls never hold while the
  drumhead and barrel differ.
- Intersections: before, seated tooth contact only; after, the same. The
  notches stop 0.008 short of the annulus body.
- Framing: the view now frames the circle the pawl eyes sweep in the
  wheel-work, so the plate view is about 17 % smaller.

## Residuals

- 389: the minimal undrawn rear spine, bridges and bosses carry the two fixed
  pins, and short bars show between the rack and the eye and strap. Lowering is
  the lifting played backward, with the stop held off by hand.
- 396: F still receives work as it withdraws (its detent-only action is
  unqualified). The direct impulse is a short contact. The balance vibration is
  prescribed.
- 402: the plate's bar from the pivot toward the wheel hub, drawn partly
  hidden behind the wheel, is not modelled. The lower pallet recoils slightly.
  The lever timing is prescribed. The balance rims and levers are unchanged.
- 412: the drumhead is omitted, so the pawl eye pins stand as short stubs.
  Brown's arrows (clockwise) are not otherwise shown. The mode changes are
  prescribed at rest.

Display profiles for 389, 396, 402 and 412 need regenerating by the
integrator (framing and geometry changed). A scratch regeneration was used
only for these captures.
