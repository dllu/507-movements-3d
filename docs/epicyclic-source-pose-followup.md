# Source-pose follow-up: 502–505

GPT-6 Astra independently inspected the current production default and advanced
oblique views against the engravings on 2026-09-16. The source captions and inline
animation registrations were also rechecked. [502](https://507movements.com/mm_502.html)
and [505](https://507movements.com/mm_505.html) have canvas models; 503/504 do not.
502's inline carrier-relative factors match the retained analytical train. 505's
oracle illustrates two choices of fixed member with reversing demonstrations;
our continuous rotation shows the caption's fixed-annulus choice only.

## Corrections

505 now starts with its carrier at 45 degrees, as in the engraving. This is a
time offset along the existing closed gear trajectory: the sun and planet both
advance to the corresponding mesh phases, while the annulus remains fixed.
The view is nearly frontal, exposing the ring, sun and planet without the former
large perspective distortion. All tooth geometry and ratios remain unchanged.

502–504 now use a 12-degree camera field of view and explicit motion bounds,
with source-facing directions. The former wide-angle sphere fit left excessive
empty space. All full-orbit bounds remain respected; 502/504 still need room for
the arm to revolve around their end pivot, so their initial off-center silhouettes
cannot fill a fixed view as completely as the cropped static drawing.

The 504 ledger flaw was stale: its current factory already has one continuous
20-tooth intermediate wheel, rather than the superseded four-band approximation.
The current [working-contact review](movement-503-504-contact.md) and rendered
assembly confirm the shared module, E/F/G stack and fixed A level with F. The
ledger now records the actual remaining inferred profile and load limitations.

## Evidence and remaining work

- 38 distinct focused checks pass across the four models, shared journals and
  503/504 working contacts. The stored contact report was regenerated because
  its source hash covers the shared factory, including the camera edits.
- The new 505 start phase passes 33 bidirectional working-gear poses: 1,246,666
  surface queries, no sampled intrusion above 1e-6 model units. This excludes
  supports and hubs, which retain their separately scoped checks.
- Repeated 503/504 working-tooth audits retain zero sampled intrusion and maximum
  nearest-surface gaps 0.003011 and 0.000600 respectively. These are finite running
  clearances, not loaded force simulations.
- Final sampled full-cycle screen extents are 0.83983, 0.75326, 0.79129 and
  0.87778 NDC for 502–505; all are inside ±1 and have no browser errors.

502 still needs its shallow engagement coverage and source proportions reviewed:
its drawn compound/central wheel silhouettes differ materially from the model's
canvas-derived tooth ratios. 503's equal 45-degree cones and axial spacing look
deeper than the flattened engraving; the back-cone involute approximation remains
explicit. 504's generated tooth proportions and supports are inferred. 505's
carrier/fixed-member clearance has not received an exhaustive assembly sweep.
Loaded friction, compliance and backlash are unsolved throughout this family.
A visual check records inspection, not completion of those residuals.

Bulk reports and captures are under `/dev/shm/family48-planetary-*`,
`/dev/shm/family48-505-*` and `/dev/shm/family48-503-504-*`.

Final integration passes the production build (23.27 seconds) and all four
packaged desktop/playback/mobile cases (13.5 seconds). Route ownership is unchanged.
