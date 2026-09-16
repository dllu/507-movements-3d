# Free escapements 291 and 313: finite working faces and journals

Status: **partial geometric corrections**, not mechanically certified escapements.

## Source

Reviewed Brown's captions and engravings for [291, Arnold's free escapement](https://507movements.com/mm_291.html) and [313, the common chronometer escapement](https://507movements.com/mm_313.html). Both pages lack an inline `ae.add_model`/`mm_present` animation, in addition to displaying the unavailable-animation class. There is no official moving oracle for these two pages.

291 separates the balance's impulse notch, operating stud, light passing spring, heavy detent spring and wheel stop. 313 separates the radial impulse pallet P from the unlocking jewel V, passing spring TV and locking stone T. The existing source arrangement and prescribed phase laws are retained; this pass does not establish passive operation of either mechanism.

## Corrections

- 313's old impulse jewel straddled its ideal working face, placing half its thickness inside the driving tooth. Its finite body now lies on the correct side of that face, retaining the full 0.15 transverse thickness. The locking stone similarly sits outside its locking face instead of being centered on the ideal tooth point. Removing the working-face bevel prevents the bevel from extending into the tooth envelope.
- 291's curved impulse body retains its 0.22 thickness but has a small radial working-face relief. Stop d now overlaps the wheel axially instead of relying on a coincident face and protruding bevel for engagement.
- Both wheels have bored hubs, shafts reaching actual bored journals, and bored supporting standards. The 291 balance has a real fixed arbor through its bored hub and rotating bars. The 313 balance hub and discharging roller are bored around their shaft.
- 313's four spokes now reach from inside the hub to inside the rim, without protruding beyond the rim or crossing the fixed arbor. Tests check actual overlap at both ends.
- Source-facing cameras use the full moving assembly's bounds, hide the artificial envelope and ground, and retain fog-free materials. `minimumDisplayCycleSeconds = 4` ensures readable production playback, including 313's nominal half-second model period.

## Finite measurements and qualification

Distances below are sampled signed distances from actual rendered wheel surface points to the finite pallet/stop meshes, not the pre-existing ideal contact metadata. Positive means clearance. Tests sample 1,025 uniform phases, plus 513 phases each over impulse and release. This is a bounded geometric regression, not a continuous all-pairs certificate.

| Pair | Current measured result |
| --- | --- |
| 313 tooth / P during active impulse | +0.00019988 to +0.00019991 |
| 313 tooth / T throughout cycle | minimum +0.00019994; seated-lock gap about +0.00020011 |
| 291 tooth / notch during active impulse | +0.00000559 to +0.00075013 |
| 291 tooth / stop d throughout cycle | minimum +0.00019993, with actual axial overlap |

313's one-sided impulse normal gives a positive balance moment of approximately 1.43–1.53 per unit force during the active stroke. Its locking-face reaction opposes clockwise wheel torque. These establish compatible force directions, not validated force magnitudes or impact dynamics.

## Remaining defects

Both mechanisms remain explicitly partial:

- **291 wheel / notch-g body:** sampled penetration reaches **0.12603** at normalized phase **0.4384766**, outside the active impulse interval. Another collision occurs during the nominal free return. The prescribed wheel/balance flight must be reconciled with the complete finite notch and tooth envelope.
- **313 tooth index 2 / impulse pallet P:** sampled return-stroke penetration reaches **0.02596** at phase **0.7324219**. The active impulse correction does not fix this separate tooth-clearance/return-law fault. The pallet has not been thinned or removed to conceal it.
- **291 operating stud / passing spring f segment 18:** a 513-phase leaf audit finds a closest sampled gap of **0.06426** at phase **0.04296875**. The finite bodies do not establish the ideal one-way contact, in part because of their depth layout.
- **313 unlocking jewel V / passing spring TV segment 16:** return-stroke penetration is **0.04487** at phase **0.751953125**. Prescribed leaf flexure does not enforce its finite contact.
- Both state laws call the wheel locked while the detent begins its scheduled withdrawal. The finite lock can already be separated before the formal release phase (sampled gaps up to approximately **0.0911** in 291 and **0.0696** in 313). These intervals have not been reclassified as validated locking contact.

Spring deformation, balance oscillation, driving torque, tooth flight and impact/restitution remain prescribed. A contact-driven native study should follow a compatible full return/leaf geometry; introducing a solver before correcting those known penetrations would not validate the current mechanism. No MuJoCo bake is claimed here.

## Validation

`node --test tests/free-escapement-solids.test.mjs tests/movement-291.test.mjs tests/movement-313.test.mjs`

The five new finite regressions and 16 existing state-law tests pass. Checks cover working clearances and retained proximity, reaction direction, hub/rim attachment, bored journal interfaces, shaft reach, stable scene/geometry identities, and readable display timing. Existing point-contact tests are interpreted only as kinematic checks.

Source/default/front/rear browser captures on Vite port 43938 produced no browser errors. A 65-pose full-cycle vertex projection found no viewport clipping: maximum absolute NDC 0.8543 for 291 and 0.8259 for 313. Review artifacts remain outside Git under `/dev/shm/free-escapement-{291,313}-{default,front,rear}.png`; the browser was closed after capture.
