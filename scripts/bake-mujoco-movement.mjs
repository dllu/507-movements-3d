#!/usr/bin/env node
// Bake a live MuJoCo movement into a seamless looping bundle.
//   node scripts/bake-mujoco-movement.mjs <id> [<id> ...] [--dry-run]
// Writes src/simulation/baked/assets/mujoco-<id>.json.gz and
// mujoco-<id>.provenance.json. The movement needs an entry in
// src/simulation/baked/mujoco-baked-routes.js (geometry-only build) and in
// scripts/lib/mujoco-bake-configs.mjs. See docs/p60-bake-tool-review.md.
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import {physicsFactories} from '../src/simulation/model-loader.js';
import {bakedMujocoRoutes} from '../src/simulation/baked/mujoco-baked-routes.js';
import {makeBakedMujocoModel} from '../src/simulation/baked/mujoco-playback.js';
import {resolveObjectKeys} from '../src/simulation/baked/mujoco-bake-format.js';
import {bakeConfigs} from './lib/mujoco-bake-configs.mjs';
import {BAKE_DEFAULTS, buildVariant, chooseLoop, disposeObject3D, hashFiles, motionSources, record, repository, rootUserData, physicsFingerprint, roundTripError, seamContinuity, sha256, structuralDiff, visualSources} from './lib/mujoco-bake.mjs';

const args = process.argv.slice(2), dryRun = args.includes('--dry-run'), ids = args.filter(a => /^\d+$/.test(a)).map(Number);
if (!ids.length) {console.error('usage: node scripts/bake-mujoco-movement.mjs <id> [...] [--dry-run]');process.exit(2);}
const mujoco = await loadMujoco();

export async function bake(id) {
  const route = bakedMujocoRoutes[id], settings = bakeConfigs[id];
  if (!route || !settings || !physicsFactories[id]) throw new Error(`Movement ${id} needs a live factory, a baked route and a bake config`);
  const config = {...BAKE_DEFAULTS, ...settings}, factory = await physicsFactories[id]();
  const variantNames = Object.keys(config.variants ?? {default: {}}), variants = {}, physicsXmlSha256 = {}, fullXmlSha256 = {}, diffs = [];
  let common;
  const started = performance.now();
  for (const name of variantNames) {
    const options = {...config.options, ...(config.variants?.[name]?.options ?? {})};
    const live = factory(mujoco, options), ref = await route.geometry();
    try {
      const period = config.period ?? live.root.userData.animationTiming?.authoredCyclePeriod;
      const totalPeriods = config.warmupPeriods + config.maxLoopPeriods + config.searchPeriods;
      const rec = record(live, {period, sampleRate: config.sampleRate, curves: config.curves, derivedMeshes: config.derivedMeshes, totalPeriods: config.cycle === 'palindrome' ? config.warmupPeriods + config.maxLoopPeriods + 1 : totalPeriods});
      let loop;
      if (config.cycle === 'palindrome') {
        const a = config.warmupPeriods * rec.samplesPerPeriod;
        loop = {k: config.warmupPeriods, n: config.maxLoopPeriods, a, b: a + config.maxLoopPeriods * rec.samplesPerPeriod, error: 0, wraps: new Map()};
      } else loop = chooseLoop(rec, config);
      variants[name] = buildVariant(rec, loop, resolveObjectKeys(ref.root), config);
      const diff = structuralDiff(live, ref);diffs.push(JSON.stringify(diff));
      common ??= {diff, rootUserData: rootUserData(live), focus: live.focus?.toArray?.(), cameraDirection: live.cameraDirection?.toArray?.(),
        playbackTimeScale: live.root.userData.animationTiming?.playbackTimeScale ?? 1};
      const xml = live.physics.description?.xml;
      if (!xml) throw new Error('Live physics exposes no description.xml to fingerprint');
      physicsXmlSha256[name] = physicsFingerprint(xml);fullXmlSha256[name] = sha256(xml);
      const v = variants[name];
      console.log(`${id} ${name}: loop ${v.loop.duration.toFixed(3)} s (${v.loop.periods} x ${period} s from ${v.loop.startTime.toFixed(3)} s, ${v.loop.samples} samples), raw seam ${v.closure.rawSeamPixels.toFixed(4)} px, max correction ${v.closure.maximumCorrectionPixels.toFixed(4)} px / ${v.closure.maximumRotationCorrection.toExponential(2)} rad, ${v.transforms.length} transform, ${v.vertices.length} vertex, ${v.visibility.length} visibility tracks`);
      if (args.includes('--verbose')) console.log(JSON.stringify({transforms: v.transforms.map(t => t.key), vertices: v.vertices.map(t => t.key), visibility: v.visibility.map(t => t.key), extras: structuralDiff(live, ref)}, (k, x) => (k === 'object' ? '[json]' : x)));
    } finally {live.dispose();disposeObject3D(ref.root);}
  }
  if (new Set(diffs).size !== 1) throw new Error('Configurations differ in their static parts; bake them as separate movements');
  const {diff} = common;
  const bundle = {format: 'mujoco-loop', version: 1, id, generator: 'scripts/bake-mujoco-movement.mjs',
    focus: common.focus, cameraDirection: common.cameraDirection, playbackTimeScale: common.playbackTimeScale,
    rootUserData: common.rootUserData, extras: diff.extras.map(({parent, object}) => ({parent, object})), removed: diff.removed,
    materialPatches: diff.materialPatches, objectPatches: diff.objectPatches,
    defaultVariant: config.defaultVariant ?? variantNames[0], variants};

  // Round trip: rebuild from the bundle as the browser does and compare with
  // the live model at recorded samples, across the seam and into the next loop.
  const roundTrip = {};
  const baked = makeBakedMujocoModel(JSON.parse(JSON.stringify(bundle)), await route.geometry(), route);
  try {
    for (const name of variantNames) {
      const live = factory(mujoco, {...config.options, ...(config.variants?.[name]?.options ?? {})});
      try {
        if (variantNames.length > 1) baked.root.userData.setConfiguration(name);
        const {duration, startTime, samples, mode} = variants[name].loop, dt = duration / samples, times = [];
        for (let j = 0; j <= 8; j++) {const s = Math.round(j * samples / 8);times.push([startTime + s * dt, s * dt]);}
        roundTrip[name] = roundTripError(live, baked, times);
        // Seam: playback must be as smooth across the loop end as inside it.
        roundTrip[name].seam = seamContinuity(baked, duration, samples, config.seamExclude);
        const seam = roundTrip[name].seam;
        console.log(`${id} ${name}: seam step ${seam.seamStepPixels.toFixed(4)} px (interior max ${seam.interiorStepPixels.toFixed(4)}), seam second difference ${seam.seamSecondPixels.toFixed(4)} px (interior max ${seam.interiorSecondPixels.toFixed(4)})`);
        if (seam.seamStepPixels > seam.interiorStepPixels + .05 || seam.seamSecondPixels > seam.interiorSecondPixels + .05) throw new Error('Playback is less smooth across the seam than inside the loop');
        const limit = variants[name].closure.rawSeamPixels + .1;
        console.log(`${id} ${name}: round trip ${roundTrip[name].pixels.toFixed(4)} px over ${roundTrip[name].compared} part samples, worst ${JSON.stringify(roundTrip[name].worst)} (limit ${limit.toFixed(3)})`);
        if (roundTrip[name].pixels > limit) throw new Error(`Round trip error ${roundTrip[name].pixels} px exceeds ${limit} px`);
      } finally {live.dispose();}
    }
  } finally {baked.dispose();}

  const bytes = gzipSync(Buffer.from(JSON.stringify(bundle)), {level: 9});
  const asset = `src/simulation/baked/assets/mujoco-${String(id).padStart(3, '0')}.json.gz`;
  const provenance = {id, generator: bundle.generator, format: bundle.format, version: bundle.version, asset, bytes: bytes.length, assetSha256: sha256(bytes),
    motionSources: hashFiles(motionSources(config.directory)), visualSourcesAtBake: hashFiles(visualSources(config.directory)), physicsXmlSha256, fullXmlSha256,
    config: Object.fromEntries(Object.entries(config).filter(([k]) => k !== 'note')), cycleDesign: config.note,
    variants: Object.fromEntries(variantNames.map(n => [n, {loop: variants[n].loop, closure: variants[n].closure, roundTripPixels: roundTrip[n].pixels, seam: roundTrip[n].seam}])),
    extras: diff.extras.map(e => e.key), removed: diff.removed, bakeSeconds: (performance.now() - started) / 1000};
  if (!dryRun) {
    fs.writeFileSync(path.join(repository, asset), bytes);
    fs.writeFileSync(path.join(repository, asset.replace('.json.gz', '.provenance.json')), JSON.stringify(provenance, null, 2) + '\n');
  }
  console.log(`${id}: ${dryRun ? 'dry run, not written' : 'wrote ' + asset} (${(bytes.length / 1024).toFixed(0)} KiB)`);
  return provenance;
}

for (const id of ids) await bake(id);
