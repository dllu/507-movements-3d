// Rank movements by loop seams: position jumps, sudden velocity changes at
// loop points, finite runs and runs that stop and hold.
//
//   node scripts/check-loop-seams.mjs [--ids=1,2,5-9] [--json=out.json]
//        [--steps=240] [--periods=3] [--all]
//
// Live MuJoCo movements (model-loader physicsFactories) are skipped; they
// have their own seamless-bake lane. Baked and authored routes load exactly
// as the browser loads them (model-loader.js). Without --all only movements
// above tolerance are printed. See scripts/lib/loop-seams.mjs.
import {readFile, writeFile} from 'node:fs/promises';
import {loadMovementModel, physicsFactories} from '../src/simulation/model-loader.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';
import {measureLoopSeams} from './lib/loop-seams.mjs';

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (resource, ...rest) => {
  const url = new URL(resource);
  return url.protocol === 'file:' ? new Response(await readFile(url)) : nativeFetch(resource, ...rest);
};

export function parseIds(text) {
  const ids = new Set();
  for (const part of text.split(',').filter(Boolean)) {
    const [a, b] = part.split('-').map(Number);
    for (let id = a; id <= (b || a); id += 1) ids.add(id);
  }
  return ids;
}

export async function checkMovement(movement, options = {}) {
  let model;
  try {
    model = await loadMovementModel(movement);
    return {id: movement.id, title: movement.title, ...measureLoopSeams(model, options)};
  } catch (error) {
    return {id: movement.id, title: movement.title, error: String(error?.stack ?? error), score: 0, issues: ['checker error']};
  } finally {
    if (model) disposeMovementModel(model);
  }
}

export const liveMujocoIds = new Set(Object.keys(physicsFactories).map(Number));

if (import.meta.url === `file://${process.argv[1]}`) {
  const argument = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;
  const requested = argument('ids') ? parseIds(argument('ids')) : null;
  const options = {stepsPerPeriod: Number(argument('steps') ?? 240), periods: Number(argument('periods') ?? 3)};
  const results = [];
  for (const movement of catalog) {
    if (requested && !requested.has(movement.id)) continue;
    if (liveMujocoIds.has(movement.id)) continue;
    const started = Date.now();
    const result = await checkMovement(movement, options);
    result.seconds = (Date.now() - started) / 1000;
    results.push(result);
    if (process.argv.includes('--progress')) console.error(movement.id, result.score?.toFixed(2), result.seconds);
  }
  results.sort((a, b) => b.score - a.score);
  const json = argument('json');
  if (json) await writeFile(json, JSON.stringify(results, null, 1));
  const shown = process.argv.includes('--all') ? results : results.filter(r => r.score > 1 || r.popScore > 1 || r.error);
  for (const r of shown) {
    const fmt = x => (x ?? 0).toFixed(4);
    console.log(`${String(r.id).padStart(3)} score=${(r.score ?? 0).toFixed(2).padStart(7)} jump=${fmt(r.maxSeamJumpAny)} pop=${fmt(r.maxPop)} kink=${(r.maxSeamKink ?? 0).toFixed(2)} periodMismatch=${fmt(r.periodMismatch)} ${r.stateless === false ? 'stateful ' : ''}${r.supportsRestart ? 'restart ' : ''}${r.error ? 'ERROR ' + r.error.split('\n')[0] : r.issues.join('; ')}`);
  }
  console.log(`${results.length} checked, ${results.filter(r => r.score > 1).length} seams above tolerance, ${results.filter(r => r.popScore > 1).length} with mid-cycle pops, ${results.filter(r => r.error).length} errors`);
}
