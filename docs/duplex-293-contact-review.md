# Movement 293: finite duplex lock and crown impulse

This supersedes **293's** unresolved working-contact portion of
[the earlier 293/296 review](duplex-lever-interface-review.md). Movement 296 is
unchanged: its pallets remain above the wheel plane and its finite fork entry,
pallet impulse and banking still need a joint reconstruction.

The [293 source](https://507movements.com/mm_293.html) shows a notched roller A,
long radial locking teeth and a separate raised crown-pin row acting on the
balance-carried pallet B. The [296 source](https://507movements.com/mm_296.html)
shows a different lever-and-fork mechanism. Both pages were checked again for
actual inline model registration and canvas/model definitions: neither has an
official animation. Their captions and engravings supply topology, not precise
profiles, operating loads or timing. No decorative raster tracing was needed.

## Working reconstruction

The former centerline tangency had zero resisting wheel moment. The radial tips
now extend 0.06 model units farther into the roller's circular orbit, putting
rest contact on its side. The original full-radius roller, useful notch, fifteen
teeth and complete escape wheel remain. Flat working teeth replace the expanding
bevels; the nonworking wheel rim is a smooth closed annulus.

An offline continuation follows clockwise wheel tendency against the actual
finite tooth and notched-roller polygons. It advances one tooth on the powered
crossing, catches the next tooth, and permits a bounded silent excursion/recoil
which returns to that same tooth. Recursive event subdivision rejects chords
that cut through a moving notch edge. The prescribed balance keeps its original
four-second period and 52-degree amplitude; free wheel advance is capped at
1.5 radians/second. Playback uses a 2,080-knot, approximately 194 KB table with
binary search, with no live collision solve or geometry generation.

A finite offset/cutter envelope replaces B's intersecting point-locus band.
Its surviving crown-impulse land has a useful resisting wheel normal and an
assisting balance normal. The return side has 0.003 nominal relief; the working
side has about 0.0005 running allowance. A raised curved arm and finite stepped
neck connect that head to the bored staff collar above the crown-pin ends.
This depth stack is an explicit reconstruction: a long coplanar blade would
cross the silent-return pin sweep. The working tip remains in the crown-pin
plane; moving the load face out of engagement is not the correction.

Wheel spokes now meet the rim and clear the arbor. The existing bored journals
and connected rear supports remain. Stale point-contact tubes/dots and the
protruding wheel-pin index are hidden. Public state, rotor transforms, contact
modes and rates use the new branch; superseded mathematical contact loci live
only under `nominal293`. The source-like initial pose uses phase 0.30. A minimum
six-second display cycle makes the short impulse and silent return readable.

## Evidence

```sh
OPENBLAS_NUM_THREADS=1 python scripts/generate-duplex-293-contact.py --check
node --test tests/movement-293.test.mjs tests/movement-296.test.mjs \
  tests/duplex-lever-interfaces.test.mjs tests/duplex-293-finite-contact.test.mjs
```

Generation requires NumPy, SciPy and Shapely. The check regenerates byte for byte.
All **23 focused and neighboring regression tests pass** in 8.55 seconds.
Obsolete assertions requiring the zero-moment lock and exact point-locus
coincidence were replaced with tests of the corrected production branch.

- **37,374,924 bidirectional actual-surface queries** cover complete shifted
  cycles, dense impulse poses, an off-grid release witness, a sample inside
  every bake segment, and a later tooth cycle. Teeth/roller, all crown pins
  against the head/arm/neck/staff, and selected shaft passages remain clear;
  minimum sampled signed separation is **0.0001664**.
- The actual roller triangle normal at rest gives resisting wheel moment
  **+2.56156**, at **0.00020001** separation.
- Actual crown-pallet triangle normals at four impulse poses give resisting
  wheel moment at least **+1.34643** and assisting balance moment at least
  **+1.50929**. Maximum pin/face gap is **0.00049653**.
- Finite stock checks independently establish head/neck and neck/arm attachment.
  Journal checks, one-tooth closure, interpolated rates and stable scene/geometry
  buffers pass. These are selected interfaces, not an exhaustive all-pairs or
  continuous-time collision proof.

Root independently inspected source/default and oblique views: no errors or
sampled clipping, maximum NDC 0.8875. The raised arm is visibly connected. That
review requested the final circular-rim correction, after which the 23 checks
were rerun; final packaged/render checks are integrated centrally. Bulk evidence
stays in `/dev/shm/family47-next-preview-293-*`,
`/dev/shm/duplex293-final-tests.log` and `/dev/shm/duplex293-regenerate.log`.

## Remaining limits

This is a finite **prescribed geometric reconstruction**, not a passive watch
simulation. Running clearances do not themselves transmit forces; exact loaded
take-up and full velocity compatibility are not established. The largest normal
relative-speed residual at the selected finite crown facets is **0.01284 model
units/second**. Facet/event transitions can change velocity abruptly, so impacts
are idealized rather than solved. The raised arm, hidden depth stack, crown
phase and notch dimensions are inferred from the undimensioned plate.

Balance forcing, wheel drive speed, spring energy, notch work, friction,
compliance, impacts, passive capture and sustained timekeeping remain
unvalidated. No MuJoCo result is claimed. The viewer explicitly retains these
limits. Movement 296's detached pallets and incompatible fork law are a separate
remaining task, not promoted by this 293 correction.

Final integration: the production build, CPU screen and packaged desktop/playback/
mobile checks pass. See the forty-seventh pass in [review progress](review-progress.md)
for the combined validation record.
