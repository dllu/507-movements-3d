# Pass 66, lane p66-247: 247 sounding-weight release loop

Reviewer: Claude Opus 5.5 (lane p66-247), 2026-09-26. Captures are outside Git in `/dev/shm/p66-247/`:
- `before/tile.png`: the HEAD loop at phases 0–10.9 s.
- `after/tile.png`: the new loop, 16 phases, at aspect 0.82.
- `after/tall.png`: aspect 0.46, 6.5–7.9 s.
- `after/247-{default,oblique}.png`: from `review-movement-source-views`.

## Problem (HEAD)

At 7.9–10.2 s (phase ≈ 0.7–0.92) the default view was empty. The rod was hauled 10 units out of the top to be re-armed.

The spent weight also faded out at 8.5–8.75 s. That fade was *visible*: the dome of the weight lying on the bottom
showed at the bottom edge of the frame, because the view reaches y ≈ 2.33 and the weight's top was at y 2.9.

## Redesign (`authored-sounding-weights.js`, `release-mechanism-working-parts.js` 247 seat)

**Frame.** The display frame now follows the rod for the whole cycle (`frame.y = recoveredBodyY - bodyY`, no clamp). The
rod therefore never leaves Brown's pose on screen. Brown's t = 0 pose and the descent, trip and fall are unchanged.

**New reset**, with no fades, no opacity and no jumps:
1. 5.6–7.2 s: the rod is hauled in 4.5 units above its recovered pose. In view, the bottom and the spent weight lying on
   it sink out of the bottom of the frame. They end at y −4.5 and −3.1, below the view even at aspect 0.46, whose
   bottom is y 1.46.
2. 7.2–9.3 s: a fresh bored weight is slid up the rod's line from below, over the probe foot and past the catch nose.
   The detent still holds the nose retracted, the same clearance the weight falls through at the trip. The weight
   starts exactly where the spent one lies, well below the view, so nothing jumps even off screen. It rises to 0.12
   above its seat and enters the frame at about 8.3 s.
3. 9.3–9.8 s: the detent is released and the catch swings its nose out under the raised weight.
4. 9.8–10.3 s: the weight is let down onto the finite nose seat. The seat module rescales this let-down so that it
   ends exactly on `support(0)`.
5. 10.3–11.1 s: the re-armed rod is lowered toward the bottom. The bottom is still out of view, so nothing moves on
   screen.

The weight is lifted by an unseen hand, as the rod is hauled by the unseen line. No hand, sling or other rigging was
added. The weight materials are no longer switched to transparent.

**Timeline keys.**
- Removed: `rodHauledClear`, `spentWeightGone`, `catchReset`, `freshWeightShown`.
- Added: `freshWeightRaised`, `detentReleased`, `catchSet`, `weightSeated`.
- Retimed: `rodRecovered` and `reloadedDescentBegins`.
- `outOfViewReset` became `freshWeightReload`, and `transmission.loopReset` was updated.
- The 247 source-presentation note was updated.

## Checks

- **Intersections** at 0.01 × 129:
  - Before (HEAD, p65): the rope pairs and the foot/bed touch at 0.0000.
  - After: the same set. The rope line/knot 0.071, eye/line 0.037 and line/tail 0.020 are deforming-rope contacts.
    The foot/bed touch is 0.0000. No weight or seabed pair.
  - An intermediate build showed a 0.02 weight/bed overlap, from a seat-offset shift applied to the whole fresh-weight
    path. It was fixed by rescaling only the let-down.
- **Seams** (`check-loop-seams --ids=247`): 0 seams and 0 pops. An intermediate build that swapped the weight between
  two off-screen positions flagged a 6.1% jump, so the fresh weight now starts at the spent weight's position.
- **Tests**:
  - `tests/movement-247.test.mjs`: 8/8. The re-arm test was rewritten. It checks that the rod is fixed in view at
    2001 samples, the weight is always visible and continuous, the hand-over happens more than 2 units below the crop,
    and the detent/catch/contact states.
  - `tests/release-mechanism-working-parts.test.mjs`: 5/5.
  - The 247 exception was removed from `tests/camera-catalog.test.mjs`. The camera test, filtered to 247, passes.
- `review-movement-source-views`: maxNdc 4.04 comes from the 24-wide sea-bottom plane at 4.86 s. This is the existing
  behaviour: the plane runs out past the sides and its ends are never in view.

## Residuals

- Visible: the fresh weight rises into view on its own, lifted by no drawn hand. This is the reload's stand-in for
  hand threading.
- Visible: at 6.5–8.2 s the frame shows the unloaded rod alone, with the catch held retracted.
- Invisible: the rod's lowering toward the bottom at the end of the loop is prescribed and off screen.
