# Pass 90, lane p90-fg: rocker fulcrums of 168 and 169

Reviewer: Claude Opus 5.5, lane p90-fg. Date: 2026-09-27.
Source: `docs/p90-audit-086-170.md` (168 and 169, medium).
Scratch and captures are in `/dev/shm/p90/fg/` (outside Git).

## Production files
The browser loads 168 and 169 through `model-loader.js`, which uses
`variable-radius-crank.js` and `linked-variable-crank.js`. Their motion comes from
`variable-radius-crank-motion.js` and `linked-variable-crank-motion.js`. This lane
claimed and edited those four files.

`authored-variable-cranks.js` was also claimed, but it was not edited. Its 168/169
factories are legacy and serve only the synchronous `registry.js` path, which
`screen-body-intersections` uses.

## Check against the plate and caption
- **Caption 168:** the pitman connects the crank "with the reciprocating moving power".
- **Caption 169:** the same, with a link in place of the slot.
- **Plate:** Brown draws that power member as a tapered lever, broken off about 1.36
  world units from the wrist. In 168 it runs up; in 169 it runs down and left.
- **Fulcrum:** neither the plate nor the caption places it.
- **Before:** the models put the fulcrum 7.776 from the wrist, which is the site
  animation's 30:10 rocker-to-spacing ratio. The default view framed only the drawn
  1.36 stub.
  - In 168, the lever ran up to a small bracket about four mechanism-lengths away.
  - In 169, the lever ran out of the frame.
- **Verdict:** the audit finding is confirmed.

## Fix: fulcrum about one pitman length from the wrist
Two fixes were possible. The first ends the lever at Brown's break and guides its end
ideally. That leaves a truncated lever swinging about an invisible point, which breaks
the "whole parts" rule. This lane used the second fix: move the fulcrum close.
- **Lever:** `rockerLength` is now 2.5, along the same drawn continuation. That is
  about one pitman length; the spans are 2.03/2.34 in 168 and 2.38/2.24 in 169.
- **Shape:** the lever keeps its tapered outline and ends in a boss (r 0.26) on the
  fulcrum pin.
- **Fulcrum support:** the old trapezoid bracket is now a plain round bearing boss
  (r 0.32). It is stayed back to the framing wall like the shaft bearings.
- **Camera:** the fit bounds now cover the whole lever and fulcrum over the full cycle,
  replacing the drawn-stub proxy. 169 gains the same invisible swept-camera envelope as
  168, so the swinging lever stays in frame.

### What the fulcrum constrains, and how the motion changed
The fulcrum makes the pitman's wrist move on a circle of radius 2.5 about a fixed
point, where it moved on a radius of 7.776 before. That one constraint closes the
four-bar formed by the auxiliary crank, the pitman and the lever. The rigid pitman then
carries the slot pin (168) or the link end (169), which drives the main crank at
varying radius. Sampled over 720 phases (`/dev/shm/p90/fg-scan.mjs`):

| | 7.776 lever (before) | 2.5 lever (after) |
|---|---|---|
| 168 slot-pin radius | 0.375–1.448 | 0.361–1.476 |
| 168 pin orbit, width × height | 1.261 × 2.753 | 1.248 × 2.785 |
| 168 lever swing | 9.6° | 31.4° |
| 169 main-link circle margins, inner / outer | 0.134 / 0.570 | 0.132 / 0.546 |
| 169 orbit, width × height | 1.128 × 2.266 | 1.119 × 2.284 |
| 169 lever swing | 9.0° | 28.9° |

The elongated pin orbit, which is the caption's point, is kept to within about 1%.
The initial joint fits to the engraving are unchanged: 1.443 px for 168, and 2.883 px
at most for 169.

168's slot was lengthened to reach radius 1.50 (the slot body runs 0.34–1.50, and
the crank arm to 1.50). The pin's new maximum radius is 1.476.

## Captures (`/dev/shm/p90/fg/`)
- `tile-168.png` and `tile-169.png` show the plate beside the default view,
  yaw +50°/elevation 20, yaw −50°/elevation −15, the back view, and phases 0.25, 0.5
  and 0.75.
- Raw captures are in `after/`.
- In both movements the linkage now fills the default frame, and the whole lever and
  its fulcrum boss stay in view at every phase. In 169 the lever no longer leaves the
  frame.

## Screens and tests
- `screen-disconnected-parts` (168, 169):
  - Slivers 0, lips 0, floating 0.
  - 168 reports one near-miss: the slot pin's 0.016 running clearance in the slot. The
    slot width is unchanged and the clearance predates this pass.
  - The new fulcrum shows only the bore clearance (0.02).
- `screen-coincident-faces`: 0 flagged pairs.
- `check-loop-seams`: 0 seams above tolerance.
- `screen-body-intersections`: unchanged. It loads the legacy registry factory
  (0.1139 in 168 and 0.1024 in 169, as in pass 49), not the production model.
- `review-variable-crank-solids` and `review-linked-variable-crank-solids` were
  regenerated. Each checks 129 poses, with 71 and 101 pairs, and finds no
  penetration above 1e-6.
- `measure-linked-variable-crank` (169 source closure) and
  `compare-variable-crank-oracle` were regenerated. The oracle's closure error is
  1.15e-14, and only the production parameters changed.
- `tests/variable-radius-crank-motion.test.mjs` and
  `tests/linked-variable-crank-motion.test.mjs` pass 7/7. They now assert the 2.5
  fulcrum, the direction of the drawn continuation, the slot-radius bound (< 1.49) and
  an outer margin > 0.54.
- `tests/camera-catalog.test.mjs` passes 168 and 169. It walks the IDs in order and first fails at 377, which belongs to another lane and was not touched here.
- `docs/validation/168-browser.json` and `169-browser.json` were not rerun, because
  they need a packaged build. Their visual-file hashes were already stale at HEAD.

## Residuals
- The fulcrum position is inferred. The site animation's 30:10 rocker ratio is no
  longer used for production; the oracle comparison still checks the closure method
  with the animation's own dimensions.
- The fulcrum boss and its rear stay are undrawn, but they are the minimal fixed pivot.
