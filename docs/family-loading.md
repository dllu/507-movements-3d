# Load the requested mechanism family

The application previously imported the synchronous model registry through both
its renderer and model loader. That registry imports every authored family,
including large generated gear/contact tables. A baked movement such as 123 paid
for all that JavaScript even though its playback needs only its recorded asset.

The application now uses `async-engine.js`. Its model loader selects baked/native
models as before, while authored models resolve through `authored-loader.js` and
literal dynamic imports in `authored-routes.js`. Only the selected authored family
is imported. Display timing was moved unchanged to `display-timing.js` so it does
not import geometry. `engine.js` retains the synchronous constructor for existing
offline review scripts; the production application does not import that entry.

The first production build reduced the main chunk from 26.31 MB to 0.59 MB
(9.16 MB to 0.15 MB gzip). These are main-chunk sizes, not total page transfers or a
claimed load-time speedup. Shared Three.js/runtime chunks and requested assets
still load. At that stage the legacy gears/intermittent families were still
4.59 MB/15.62 MB; the intermittent follow-up is described below.
No physics or geometry work was removed from the selected mechanism.

## Intermittent family split, forty-third pass

The common intermittent entry point still caused a fresh 233 or 75 page to
request **18,470,573 bytes of JavaScript**, including recordings for unrelated
mechanisms. Its ordinary factories now live in `authored-intermittent-core.js`.
`authored-intermittent.js` preserves the synchronous public entry point, while
the offline route generator resolves its 19 independent no-argument delegates
into separate literal imports. The browser never needs the compatibility
wrapper's complete collection of recordings.

On the final production build, fresh portable pages request **3,052,212 bytes**
for 233 and **3,326,606 bytes** for 75, reductions of about **83%** and **82%**.
These are uncompressed JavaScript response sizes on the same static server,
including shared runtime/app chunks; they exclude images and are not frame-rate
or network-latency claims. The final 233 measurement includes the new 213 contact
table shared by the core family. Bulk network records are
`/dev/shm/family43-load-{before,final}.json`.

All 507 synchronous/lazy geometry, sampled-transform and timing fingerprints
still agree. All 277 generated routes reproduce under `--check`. Six packaged
loading/cancellation cases pass, including new 75/233 transfer-budget checks;
the complete ten-case pass also checks 212/213/294/295 desktop playback and
mobile resizing. The final production build passes in 22.22 seconds.

The separate legacy gear bundle and the largest individual recordings remain
performance follow-ups. Historical one-off integration scripts targeting the
old monolithic source belong to their recorded baselines; current ordinary
intermittent factory edits should target the core file.

## Keep routing in sync

When adding a factory or changing which IDs an authored factory handles, run:

```sh
node --expose-gc scripts/generate-authored-routes.mjs
node --expose-gc scripts/generate-authored-routes.mjs --check
node --test tests/authored-loader.test.mjs tests/engine.test.mjs
```

The generator resolves the existing ordered registry offline for all 507 movements,
disposes each instantiated model and writes the winning family import. The check
mode rejects stale routing. Generated routes are coordination data, not evidence
that a movement's mechanics are correct.

The loader regression compares all 507 legacy/lazy models: exact geometry buffers,
world transforms at two poses, camera direction, mechanism identity and display
timing. It also checks exhaustive ID coverage and invalid-ID rejection. Together
with existing renderer tests, all nine tests passed. Production browser tests
check 123, 255 and 273 load no unrelated authored families or MuJoCo, plus cancellation
while a family import is deliberately held pending. Existing baked 123 playback,
Restart, section view and mobile resizing remain the integration reference.

The final packaged build passed all five browser checks (including the existing
123 playback test). The held-import navigation test reached 273 without the
cancelled 255 model replacing its canvas. The three network checks observed only
the requested authored family, or none for baked 123. These checks ran from the
portable subdirectory with relative assets.
