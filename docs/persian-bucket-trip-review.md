# Persian wheel 441: finite trip and receiver

The [official caption and engraving](https://507movements.com/mm_441.html) specify freely suspended buckets emptied by a stationary pin, but do not depict the pin or receiver in detail. The fetched page offers no active 2D animation or canvas model. Six curved floats, the hollow shaft, suspension positions and counterclockwise wheel direction remain source grounded; the trip shoe, support and receiver dimensions are explicitly reconstructed.

The former animation placed the round lug center inside the fixed pin and rotated the bucket clockwise into the receiver. Each bucket now carries a finite capsule shoe outboard of its wall. A fixed round pin blocks the upright shoe, and its exact tangency equation determines the rising counterclockwise tilt. The angle reaches 85.0006 degrees continuously. After that maximum a prescribed quintic return clears the pin and restores the upright bucket before it reaches the top source pose. There is no angular teleport or live collision search. The pin remains connected to its stationary bracket and post; two standoffs connect each shoe to its bucket.

Buckets are moved axially forward of the float channels, with correspondingly longer bored suspension pins. Hanger ends now meet the eye outside its bore. The receiver occupies the inboard region in front of the float plane, below the passing raised buckets, and has an outboard standard and bridge. Its lowered floor still delivers above the hollow-shaft center and well above the source stream. Discharge columns begin at the rotating low mouth edge and terminate on the receiver floor; their complete rendered widths remain inside its sides. The source-facing camera keeps the full cycle in view. The existing twelve-second minimum cycle, hidden viewer ground and disabled fog remain.

This qualifies finite geometry and a continuous contact-constrained rising branch, **not a passive dynamics solve**. Wheel speed and upright hanging are prescribed; impact impulses, contact forces, masses, free pendulum motion and hydraulic drive torque are not calculated. The chosen departure at the angle maximum and subsequent gravity return are kinematic assumptions. Bucket water remains an illustrative level surface and scheduled fill; its volume, containment during large tilt, slosh and flow rate are not validated. The discharge columns demonstrate a receiving path, not a fluid trajectory simulation.

Validation combines 10,001 input angles for analytic pin/shoe separation (including actual blocking of the unrotated shoe), 97 poses with bidirectional actual mesh-surface checks against trip hardware, receiver and shaft supports, and 513 poses checking mouth-to-receiver discharge placement. Existing bucket law and object/geometry identity regressions are retained. Source/default/front/advanced Chrome captures report no errors; a 17-pose visible-vertex framing sweep has maximum NDC 0.837. Captures stay in `/dev/shm`. Local update timing after warm-up was 0.032 ms median and 0.047 ms P95; no geometry is created during updates.

Run:

```
node --test tests/persian-bucket-trip.test.mjs tests/water-lifting-441-443-solids.test.mjs tests/movement-441.test.mjs tests/movement-442.test.mjs tests/movement-443.test.mjs
```
