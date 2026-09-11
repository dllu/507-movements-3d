import { readFile, writeFile } from 'node:fs/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { starMangleContactSpline } from '../src/simulation/star-mangle-contact-motion.js';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { firstPinionContact } from './lib/star-mangle-angular-contact.mjs';

if (!isMainThread) {
  const data = JSON.parse(await readFile(workerData.profilePath, 'utf8'));
  const model = makeStarMangleCandidate(data), parts = model.root.userData.parts;
  parentPort.on('message', ({ pathTravel }) => {
    model.root.userData.updateTravel(pathTravel); model.root.updateMatrixWorld(true);
    const result = firstPinionContact({ teeth: parts.teeth, pinion: parts.pinion, maximumAdvance: 0.15 });
    if (!result.witness) throw new Error(`No driving contact near path ${pathTravel}`);
    parentPort.postMessage({ pathTravel, advance: result.advance });
  });
} else {
  const profilePath = process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate32-refined-profiles.json';
  const output = process.env.MAP_OUTPUT ?? 'artifacts/review/054-candidate32-contact-map.json';
  const data = JSON.parse(await readFile(profilePath, 'utf8')), period = data.parameters.cycleTravel;
  const start = performance.now(), cache = new Map(), workers = [];
  const tolerance = Number(process.env.MAP_TOLERANCE ?? 0.000035), phaseBackoff = 0.00015;
  const initialSegments = Math.ceil(period / (2 * Math.PI) * Number(process.env.MAP_SAMPLES_PER_TURN ?? 128));
  let queries = 0;
  const key = (x) => x.toPrecision(16);
  const progress = async (state) => writeFile(output.replace(/\.json$/, '-progress.json'), JSON.stringify({
    pid: process.pid, profilePath, queries, elapsedSeconds: (performance.now() - start) / 1000, ...state }, null, 2) + '\n');
  const invoke = (worker, pathTravel) => new Promise((resolve, reject) => {
    const onError = (error) => { worker.off('message', onMessage); reject(error); };
    const onMessage = (value) => { worker.off('error', onError); resolve(value); };
    worker.once('message', onMessage); worker.once('error', onError); worker.postMessage({ pathTravel });
  });
  const evaluate = async (paths) => {
    const missing = [...new Map(paths.filter((x) => !cache.has(key(x))).map((x) => [key(x), x])).values()];
    let cursor = 0, completed = 0;
    await Promise.all(workers.map(async (worker) => {
      while (cursor < missing.length) {
        const x = missing[cursor++], result = await invoke(worker, x);
        cache.set(key(x), result.advance); queries += 1; completed += 1;
        if (completed % 128 === 0 || completed === missing.length) console.log(JSON.stringify({
          batchCompleted: completed, batchTotal: missing.length, queries, elapsedSeconds: (performance.now() - start) / 1000 }));
      }
    }));
  };
  try {
    for (let i = 0; i < Number(process.env.MAP_WORKERS ?? 8); i += 1) workers.push(new Worker(new URL(import.meta.url), { workerData: { profilePath } }));
    let stations = Array.from({ length: initialSegments + 1 }, (_, i) => period * i / initialSegments), final;
    await progress({ status: 'running', phase: 'initial', initialSegments });
    await evaluate(stations);
    // Both endpoints represent identical unmarked pinion and wheel geometry.
    const seamDifference = Math.abs(cache.get(key(0)) - cache.get(key(period)));
    if (seamDifference > tolerance / 4) throw new Error(`Contact map seam differs by ${seamDifference}`);
    const seam = Math.min(cache.get(key(0)), cache.get(key(period))); cache.set(key(0), seam); cache.set(key(period), seam);
    for (let round = 0; round < 12; round += 1) {
      const nodes = stations.map((x) => [x, cache.get(key(x))]), spline = starMangleContactSpline(nodes), checks = [];
      if (spline.minimumInputDerivative <= 0) throw new Error(`Input phase is not monotone: ${spline.minimumInputDerivative}`);
      for (let i = 0; i + 1 < stations.length; i += 1) for (const fraction of [0.25, 0.5, 0.75]) checks.push(stations[i] + fraction * (stations[i + 1] - stations[i]));
      await progress({ status: 'running', phase: 'interpolation', round, nodes: nodes.length });
      await evaluate(checks);
      const additions = []; let maximumError = 0, maximumOverrun = 0, maximumUnderrun = 0;
      for (const x of checks) {
        const error = spline.at(x).advance - cache.get(key(x));
        maximumError = Math.max(maximumError, Math.abs(error)); maximumOverrun = Math.max(maximumOverrun, error); maximumUnderrun = Math.max(maximumUnderrun, -error);
        if (Math.abs(error) > tolerance) additions.push(x);
      }
      console.log(JSON.stringify({ round, nodes: nodes.length, added: additions.length, maximumError,
        minimumInputDerivative: spline.minimumInputDerivative, maximumInputDerivative: spline.maximumInputDerivative }));
      if (additions.length === 0) {
        final = { status: 'candidate-map-interpolation-verified', profilePath, parameters: data.parameters, phaseBackoff, tolerance,
          method: 'First rotating contact of axial-clipped wheel triangles and the actual pinion polygon, followed by periodic PCHIP and independent quarter/midpoint checks.',
          nodes, queries, interpolation: { samples: checks.length, maximumError, maximumOverrun, maximumUnderrun,
            minimumInputDerivative: spline.minimumInputDerivative, maximumInputDerivative: spline.maximumInputDerivative },
          seamDifference, elapsedSeconds: (performance.now() - start) / 1000 };
        break;
      }
      stations = [...new Set([...stations, ...additions])].sort((a, b) => a - b);
    }
    if (!final) throw new Error('Contact-map interpolation did not converge within twelve refinement rounds.');
    await writeFile(output, JSON.stringify(final) + '\n'); await progress({ status: 'complete', nodes: final.nodes.length, interpolation: final.interpolation });
    console.log(JSON.stringify({ output, nodes: final.nodes.length, queries, elapsedSeconds: final.elapsedSeconds }));
  } catch (error) {
    await progress({ status: 'failed', error: error.stack }); throw error;
  } finally { await Promise.all(workers.map((worker) => worker.terminate())); }
}
