# 507 Movements — in 3D

An original, portable Three.js interpretation of all 507 mechanisms in Henry T.
Brown's *Five Hundred and Seven Mechanical Movements* (1868/1908 edition).

The app uses the public-domain descriptions as catalog data. It does **not**
copy or convert the proprietary canvas animations on 507movements.com.

## Current model coverage

- Movements 001–507 have individually authored geometry and kinematics.
- MuJoCo is the default engine for ongoing reconstruction. Movements 082 and 083
  run live joint and contact dynamics in the catalog; other entries are being
  migrated incrementally. See [simulation architecture](docs/mujoco-integration.md).
- Source fidelity, interference, and visual quality are being rechecked across
  the collection. Authored coverage and passing numerical tests do not certify
  the correctness of every reconstruction. See [review progress](docs/review-progress.md).
- Playback aims for a two-second cycle, limited by measured part rotation rates
  to keep reductions and multi-stage demonstrations readable.

## Develop

```bash
npm install
npm run dev
```

Refresh the local catalog only when the source text changes:

```bash
npm run catalog
```

## Portable build

```bash
npm run build
```

Copy the resulting `dist/` directory to any static file server. The app uses
hash routing and relative assets, so it works from a domain root or subfolder
without rewrite rules.
Serve `.wasm` files as `application/wasm`; the physics engine is bundled locally
and loaded when opening a movement that uses it.

## Verification

```bash
npm test
npm run test:e2e
```
