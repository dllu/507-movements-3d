# 293 / 296: duplex and lever interfaces

This is a bounded **partial correction**. It qualifies the new shafts, bored
journals and rear supports, and improves source visibility. It does **not**
qualify either escapement's working contact law. Their remaining faults are
stated in the browser reconstruction notes and below.

## Sources and changes

The [293 caption](https://507movements.com/mm_293.html) distinguishes long radial
locking teeth from raised crown teeth that impulse a balance-carried pallet.
The [296 caption](https://507movements.com/mm_296.html) specifies one rigid pallet
anchor and lever E–C, with a balance pin entering notch E near each vibration's
middle. Both official pages supply static engravings; no canvas animation is
available. Analytical intended circles were used directly; no decorative
contour tracing was needed.

Both mechanisms previously used solid wheel hubs and torus journal decorations.
Several arbors stopped before their bearings; 293's staff also stopped short of
its attached foreground assembly. This pass:

- Replaces wheel hubs and journals with actual through bores and extends the
  working arbors through their bearing lengths, with 0.006 radial clearance.
- Bores 293's notched roller around its staff, and 296's fork hub and roller disk
  around their respective arbors. Adds 296's missing fork arbor.
- Replaces the disconnected diagonal rear standard with bridge and attachment
  posts that join the actual journal bodies. Shaft ends clear the solid posts.
- Restores 296's widened, flat right-hand lever end C as a quadrilateral plate
  of the same depth, overlapping the original rigid anchor.
- Hides the extra foreground balance rims/spokes, which are not shown in these
  plates and obscured the roller, notch and pallet interfaces. The authored
  balance transforms and component metadata remain available.
- Removes the base/ground from the displayed view, disables material fog, uses
  a source-facing camera fitted over the full cycle, and enforces a four-second
  minimum display cycle.

The existing prescribed motion laws are retained. Incompatible alternatives
were studied but were not shipped as qualified working geometry.

## Verification

```sh
node --test tests/duplex-lever-interfaces.test.mjs \
  tests/movement-293.test.mjs tests/movement-296.test.mjs
node scripts/review-duplex-lever-contact.mjs \
  /dev/shm/duplex-lever-contact-diagnostic.json
```

The 24 focused and legacy checks pass. New finite-interface checks cover 17
poses spanning each complete authored cycle, sampling rendered vertices, edge
midpoints and triangle centroids:

| Movement | Shaft/bore/support surface queries | Result |
| --- | ---: | --- |
| 293 | 98,260 | No penetration; clearance at least 0.005 |
| 296 | 206,346 | No penetration; clearance at least 0.005 |

The new rigid C extension also passes 613,784 two-direction surface queries
against all wheel teeth and the rim, balance pin/disk/staff, wheel shaft, banking
pins and rear supports at 65 poses plus eight event boundaries. Minimum sampled
clearance is at least 0.005. Its intentional joint to the rigid anchor is checked separately: sampled
attachment overlap exceeds 0.02, and the tab has the same fork depth.

The same checks verify stable scene/geometry buffers, actual material fog flags,
source camera direction, timing minimum, and explicit residual metadata. Legacy
motion tests establish consistency with prescribed schedules, not physical
validation of those schedules.

## Remaining contact faults

**293:** The nominal long-tooth orbit is externally tangent to the locking
roller at the line between their centers. Its reaction has zero moment against
wheel rotation, so this geometry cannot positively lock the driven wheel. A
65-pose rendered-surface diagnostic also finds up to 0.00703 tooth/roller
penetration and 0.04495 crown-pin/pallet penetration on the silent return.

A bounded alternative added 0.05 radial overlap and moved rest contact onto the
roller flank. Sweeping the retained schedule then erased up to 0.0384 from the
intended roller contact and 0.0991 from the crown-pallet contact. That candidate
was rejected and reverted: a new compatible release, silent-return and impulse
law is required. No hollowed-out pallet or notch is shipped as a solution.

**296:** The pallet bodies lie above the wheel's working depth (over 0.03 model
units of axial separation). The prescribed ±7° fork motion and curved tines are
not a demonstrated finite balance-pin handoff. A future correction must derive
fork motion, open-notch entry/exit, pallet impulse and banking together; merely
moving the old pallets into the wheel plane would not establish compatibility.
The diagnostic samples pin/tine surfaces but does not qualify their contact
proximity or driving reaction. The current source-facing view and note expose
this limitation rather than describing the mechanism as contact-validated.

Neither model has validated train torque, impact compliance, friction, balance
energy transfer or sustained passive running. No MuJoCo result is claimed;
these unresolved geometry/kinematics must be made coherent before a dynamics
study can meaningfully validate them.

## Browser review

Source/default/front/advanced captures on the shared development build
(before the final round-to-flat C-tab correction on 296)
reported no browser errors and no camera clipping over 17 full-cycle poses:

| Movement | Maximum NDC extent | Draw calls | Rendered triangles, including shadows |
| --- | ---: | ---: | ---: |
| 293 | 0.889 | 104 | 27,120 |
| 296 | 0.878 | 110 | 43,752 |

The final C tab passed the revised clearance and attachment checks; the root
integration review captures its final source/default/oblique views.

The source-facing views keep the complete wheels visible; Brown crops 293's
wheel in the engraving. They do not conceal the unresolved working-interface
limitations. Local cold factory measurements were 73/44 ms for 293/296;
mean updates over 10,000 steps were 0.0023/0.0040 ms. No offline sweep or physics
solver is loaded by these production factories.

Captures remain outside Git at
`/dev/shm/duplex-lever-final-{293,296}-{default,front,advanced}.png`.
