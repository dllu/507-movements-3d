# 490 playback allocation correction

This records the earlier performance-only pass. Its queued layout issues are
addressed by the subsequent [spatial reconstruction](rope-steering-spatial-review.md);
that review states the current geometry, measurements and remaining limits.

The [official plan and caption](https://507movements.com/mm_490.html) show a
handwheel/barrel, two guide pulleys and one rope ending on the rudder tiller.
This pass improves playback cost while preserving the existing reconstruction's
curve and differential-payout motion. It does **not** qualify its physical layout.

## Change and measured result

`update-tube-path.js` refills the existing position and normal attributes using
Three's arc-length samples and transported frames. It preserves the tube's
indices, UVs, geometry object and typed arrays, and updates its bounds. The
former implementation allocated, uploaded and disposed a new 220-segment tube
every frame. The inverse-angle solver also no longer constructs rendering
polylines during its 64 bisection steps or derivative probes; it uses the same
branch-length calculations without generating those points.

In a sequential local comparison, each version warmed up for 100 updates and
then ran 1,000 timed updates including world matrices. Median/P95 update cost
changed from 0.868/1.115 ms to 0.535/0.678 ms. At 65 full-cycle poses, old/new
rope vertex coordinates and sampled motion states were identical. These CPU
numbers are workstation measurements, not a browser frame-rate guarantee.

Playback now retains its authored eight-second cycle, with generic ground and
material fog disabled. Ten focused tests pass, including 65-pose comparison
against freshly constructed reference TubeGeometry surfaces, stable GPU-buffer
identities and no disposal during updates. The screen no longer flags replacement
geometry. Chrome source/default/advanced review found no browser errors and no
clipping across 17 poses (maximum absolute projected coordinate 0.9184).

```sh
node --test tests/movement-490.test.mjs tests/rope-steering-performance.test.mjs
node scripts/screen-movement-batches.mjs --ids=490 --out=/dev/shm/490-screen.json
```

## Mechanical reconstruction still queued

The plan shows the handwheel and barrel shaft lying across the page, with the
handwheel viewed edge-on. The existing reconstruction instead puts that shaft
normal to its plan and shows a circular handwheel. Relative guide placement also
needs correction against the engraving. Its rendered barrel and toroidal guide
surfaces intersect the finite rope about their mathematical centerline contacts;
reference-surface parity tests intentionally do not certify these contacts.
A subsequent correction needs the proper spatial barrel/rope routing, compatible
finite drum/sheave grooves, supports and attachments, followed by source and
contact checks. The current free-branch length sum varies with helm angle;
slack accommodation, friction and tension remain unsolved.
