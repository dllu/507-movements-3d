# 297: lantern-wheel construction and support pass

The [official page](https://507movements.com/mm_297.html) names a lantern wheel
and one arm A carrying pallets B and C. The static plate shows eight circular
trundle ends and a direction arrow. Its Animated tab is unavailable; neither
`ae.add_model` nor `mm_present` occurs in the page. Regular circles and straight
members are reconstructed analytically; there is no benefit to tracing their
hand-drawn distortion.

## Corrected construction

`lantern-working-parts.js` reuses the finite ring, bored lathe and plate helpers.
Both end rings are circular, with eight spokes that actually join their hubs
and rings. The former spokes stopped about 0.24 short of the inner ring edge.
The hubs have real shaft passages. The wheel shaft and an added arm arbor
reach actual bored journals; a compact bored rear plate joins both supports.
Attachment overlaps and shaft clearances are tested separately.

The invented base, loose framing envelope and floating arm/label indicators
are hidden. Small surface-painted marks replace the raised wheel ring and
sphere. The source-facing default view fits visible geometry across the whole
cycle, retains the complete cage for orbit inspection, disables ground/fog,
and uses a minimum four-second display cycle. Playback retains all mesh buffers.

## Explicit unresolved working contact

This pass does **not** qualify the escapement's working contact. The old
analytical equations equate one pin surface point with a pallet line, but the
finite pallets and depth layout are incompatible with that schedule.

A 129-pose rendered-surface audit finds trundle penetration up to 0.058 into a
pallet, front-ring penetration up to 0.128 into a pallet, and ring/arm and
spoke/arm interference. The rocking arm and pallets occupy the front end-plate
depth. Moving them axially to avoid the plate without providing a coherent
connection and real pin contact would merely hide the problem.

There is also a force-direction defect: the current face normal on each active
pin points in the nominal forward wheel direction, rather than resisting its
drive. Simply reversing the backing or trimming the unused face ends does not
close the full release path. Exploratory two-body native runs with finite
boxes and pins did not produce reliable forward indexing after that reversal;
they are diagnostic trials, not validation of the visible mechanism. No native
trajectory or trimmed load face is adopted. The working schedule, depth layout
and source interpretation require a coupled follow-up reconstruction.

These limits appear in the model's reconstruction note. Correct shaft and
spoke geometry is not evidence that the whole escapement works.

## Verification

```sh
node --test tests/lantern-working-solids.test.mjs tests/movement-297.test.mjs
```

All 11 checks pass. The 65-pose shaft/journal/support audit makes 730,470
surface queries, with minimum clearance 0.005800. Bidirectional solid checks
confirm all eight spoke attachments, all eight trundles at both end rings,
and both journal attachments. Bounds and geometry identities remain stable.
These structural checks deliberately exclude the unresolved working pallets.

Browser source/default/oblique captures have no errors or camera clipping;
maximum full-cycle NDC extent is 0.879. Packaged playback checks are recorded
with the thirtieth family batch. Bulk diagnostic and review artifacts
remain outside Git under `/dev/shm/lantern30-*`.
