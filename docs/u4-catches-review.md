# Pass-51 user-feedback lane u4-catches: 183, 184, 186–189

The user reported three problems after reviewing the running app:

- 183: the catchers look very different from the engraving.
- 186 and 187: they look quite wrong and run far too fast.
- 188 and 189: they also run too fast, and 188 is disconnected at a.

Each movement was captured against its plate before and after the changes
(`scripts/review-movement-source-views.mjs`), including several phases of the
cycle. The motion laws were also sampled numerically.

## Speed (186–189)

`display-timing.js` squeezes every authored cycle into a 2 s display cycle
unless the model sets `minimumDisplayCycleSeconds`.

- Before: the 16–18 s authored sequences played in 2 s, so an eccentric turn
  took about 0.3 s.
- Now: each model sets `animationTiming.authoredCyclePeriod` and
  `minimumDisplayCycleSeconds` to its own period (15.4–16 s), so it plays in
  real time. The eccentric turns about once every 2–2.7 s. Each operator
  action (pull, latch, hold, release, lower) takes 0.4–2.2 s, with smooth
  easing.
- For comparison, 179 plays in 24 s and 183/184 play in 12 s.

## File structure

`authored-gab-disengagers.js` is now only the dispatcher. Each movement has
its own module: `gab-disengager-186.js` to `gab-disengager-189.js`.
`gab-disengager-shared.js` holds the helpers the modules still use.

Each model exposes `jointChecks` (plate and pin pairs) and `rigidBodies`:

- `tests/gab-joint-solids.test.mjs` now checks every declared joint for a
  real bore.
- `scripts/review-gab-cam-solids.mjs` now screens the whole assembly of all
  four movements (every mesh against every other rigid body, over 129 poses)
  and rewrites `docs/validation/186-187-cam-solids.json`. The result is
  `sampled-assembly-clear`.
- `tests/gab-cam-contact.test.mjs` was removed. It tested the old hidden
  shoulder mechanism, which no longer exists. The new contacts (claw foot on
  pin, cam on pin, toe on pin) are tested in each movement's own test.
- Brown draws no frames, and none are built now, so the `remove` entries for
  186–189 in `source-presentation.js` were dropped.

## 186 (rebuilt)

**Parts**, traced from the plate:

- A broad tapered rocker with a hatched shaft section.
- The rod, with its forked groove, round crown, and a gab cut up around the
  19 px pin.
- A claw lever on pin c. It has a claw, a curved arm, a fork head with its
  pin ends, and a drop that ends in notch a.
- A flat spring handle, 14 px wide. It is riveted to a pad just below and
  right of c, mostly hidden by the rod. The strap runs down the diagonal bar,
  around the loop and along the top to a free end under a.

**Operation.** Pulling the loop turns the lever. Its hidden claw foot, which
Brown dashes behind the rocker, bears on the pin and lifts the rod 42 px, so
the gab clears the pin by 4 px. The free end then slides into notch a.
Releasing reverses this.

**Motion.** The eccentric stops while the rod is held clear. The loop keeps
its rest shape and turns with the lever. The bar bends smoothly over about
30 px below its pad; a test checks that no radius is tighter than 1.5 strap
widths. Only the last 6 px of the free end flex into notch a.

**Intersections.** None before or after.

**Residuals:**
- The lever has to turn about 29°, which the claw's reach sets.
- The claw's knuckle is hidden behind the rocker, where Brown draws it
  solid.
- The strap leaves the rod as a bent strip, not the broad blade Brown draws
  there.

## 187 (rebuilt)

**Parts:**

- The valve arm has its rockshaft boss and a round lower boss around the pin.
- The rod includes its crown, the gab slot and the lower handle.
- The upper handle pivots in the crown. Its cam lobe, which Brown dashes,
  sits behind the crown.

**Operation.** The cam is a computed profile that stays in contact with the
pin: about 0.016 px of contact and no penetration. Raising the upper grip
35° lifts the rod 39 px, clearing the pin by 2.6 px.

Brown's 32 px gap between the grips cannot give the 37 px gab lift, so the
grip is raised rather than squeezed.

**Intersections.** None.

**Residuals:**
- The cam is larger than Brown's dashed outline, but it stays hidden.
- The shaft section is shown plain, not hatched.
- The fork lines at the rod end are not modelled.

## 188 (rebuilt)

**The disconnection at a is fixed.** The loop handle is now one rigid piece:
hub, diagonal, loop and limb, ending at a. The leaf spring's head sits under
the limb's end at the step a in every frame, with a 0.002 gap.

**Parts:**

- The rod has a crown, an open-bottom gab and a nosed tail.
- The handle's arch drops behind the crown (Brown's dashed legs) to a toe
  that rests on the pin.
- The yellow cam piece that hung below the rod, which Brown does not draw,
  is gone.

**Operation.** Swinging the loop up turns the handle 17.9°, and the rod lifts
31.5 px off the pin.

**Catalog archetype.** It is restored to the catalog value.

**Intersections.** None.

**Residuals:**
- The leaf props the lifted limb rather than snapping into a separate notch.
- Its foot slides under the clip so that its length stays constant.

## 189 (rebuilt)

**Parts:**

- The valve lever has its hatched shaft and a disc behind the gab.
- The forked rod has a raised crown, a round-topped gab and a tail eye.
- An upright bell crank sits at Brown's vertical-rod position, with a hanging
  link behind both eyes.
- There is no frame.

**Operation.** The bell crank swings 39.2° to lift the gab clear, which the
plate's crank proportions require. The rod then makes a free turn over the
resting pin.

**Intersections.** None.

**Residuals:**
- The fork is a through-slot, not Brown's recessed channels.

## 183 and 184 (catch shapes reworked)

**The problem.** The upper wing was a thin rim and fan with a straight-sided
window. The C-arm was a thin band ending in a round knob. The lower quadrant
had a nose sector that ran far past Brown's band end over the piston rod, and
a straight web.

**The fix: shapes traced from plate 183.** The ink faces of each casting were
filled, split at the hub and smoothed by 1.6 px. The outlines are stored in
`quadrant-catch-finite-parts.js`:

- The upper casting is a broad C-arm and Brown's hooked tip. Only the part
  hidden behind the band is inferred, from his dashed lines.
- Its wing has the pointed window and the S-lobe down to the toe. Its rim is
  trimmed to the arc concentric with its shaft.
- The lower quadrant is a band with squared ends and an anvil window between
  two curved web arms.

**Catches.** Brown's visible shapes cannot hold one another in any
consistent mechanism. Studs that passed through the drawn S-lobe would have
collided with it. So both catches now sit on hidden layers, inside drawn
outlines:

- **Bottom catch.** A stud on the hidden part of the upper arm sits under a
  rear lip on the lower quadrant. The lip stays inside the band end (to
  -136°) and is concentric with its shaft. A lead-in lets it cam the stud
  home as the lower handle falls.
- **Top catch.** A stud behind the band's left end rests on a boss on the
  wing rim. The boss is inside the rim outline, and its outer face is
  concentric with the upper shaft.
- **Layers, back to front:** wing (X), arm (A), boss (M), lip (N), band (Y),
  lower arm (B).

**The re-solved cycle** (`scripts/bake-quadrant-catch.mjs`, rebaked):

1. The upper handle is released at about 13° of lower lift.
2. It follows the tappet to its valve stop, now at 45° (the wider traced arm
   meets the tappet at the top).
3. The lower handle rests on the boss at 53°.
4. On the down stroke the tappet takes the lower handle off the boss, about
   1.5° upward, and both handles ride down.
5. The lip cams the upper stud home.

**Solver changes:**
- A falling handle now settles to less than 0.002 px² of overlap.
- A handle at its limit must be tight.

**Tests.** `quadrant-catch-finite-interfaces` was updated for the new release
angles. The per-contact overlap check is no longer summed across two seated
contacts. `movement-184` now checks the 52–53° latched lift.

**Intersections.**
- Before: 0.0002.
- After: 0.0005. This is the seated stud-on-lip contact; the boss-on-stud
  contact is 0.0001 (`show-body-intersections`).
- `docs/validation/183-current-solids.json`: 0.00055 (183) and 0.00053 (184).

**Residuals:**
- Two small hidden studs and the lip's lead-in are inferred. A few pixels of
  the lip show at the band's left end, roughly where Brown draws a step.
- Plate 184 draws the handles with their roles mirrored, so its catches
  differ in the plate. 184 remains the same gear at the top of the stroke.
- Weights, friction and impact are not solved.
