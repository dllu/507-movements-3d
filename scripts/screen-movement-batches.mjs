import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {performance} from 'node:perf_hooks';
import {movementBatches, batchAssignments, expandIds} from './lib/movement-batches.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;
const assignments = batchAssignments();
const args = process.argv.slice(2);
const value = flag => args.find(arg => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

if (value('--worker')) {
  const id = Number(value('--worker'));
  const {createMovementModel} = await import('../src/simulation/registry.js');
  const {disposeMovementModel} = await import('../src/simulation/dispose-model.js');
  const start = performance.now();
  const model = createMovementModel(catalog[id - 1]);
  const constructMs = performance.now() - start;
  try {
    const root = model.root, geometrySet = new Set();
    let meshes = 0, drawCallsEstimate = 0, renderedTriangles = 0, geometryBytes = 0;
    let finiteGeometry = true, finiteTransforms = true;
    root.traverseVisible(object => {
      const geometry = object.geometry;
      if (!geometry) return;
      if (object.isMesh) {
        meshes++;
        drawCallsEstimate += Array.isArray(object.material) ? geometry.groups.length : 1;
        renderedTriangles += (geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3 * (object.isInstancedMesh ? object.count : 1);
      }
      if (geometrySet.has(geometry)) return;
      geometrySet.add(geometry);
      geometryBytes += geometry.index?.array.byteLength ?? 0;
      for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array?.byteLength ?? 0;
      for (const coordinate of geometry.attributes.position?.array ?? []) finiteGeometry &&= Number.isFinite(coordinate);
    });
    // A readable display beat can be shorter than the mechanism sequence:
    // 371 reverses only after several input revolutions. Screen that full
    // sequence rather than repeatedly checking its first driving branch.
    const displayPeriod = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
    const mechanismPeriod = root.userData.geometry?.mechanismCyclePeriod;
    const period = Number.isFinite(mechanismPeriod) && mechanismPeriod > 0
      ? Math.max(displayPeriod, mechanismPeriod) : displayPeriod;
    const sceneSnapshot = () => {
      const objects = new Set(), geometries = new Set();
      root.traverse(object => {
        objects.add(object);
        if (object.geometry) geometries.add(object.geometry);
      });
      return {objects, geometries};
    };
    const initialScene = sceneSnapshot();
    const costs = [];
    for (let i = 0; i <= 48; i++) {
      const before = performance.now();
      model.update?.(period * i / 48, i ? period / 48 : 0);
      root.updateMatrixWorld(true);
      costs.push(performance.now() - before);
      root.traverse(object => { finiteTransforms &&= object.matrixWorld.elements.every(Number.isFinite); });
    }
    const finalScene = sceneSnapshot();
    const sceneObjectGrowth = finalScene.objects.size - initialScene.objects.size;
    const newGeometryCount = [...finalScene.geometries].filter(geometry => !initialScene.geometries.has(geometry)).length;
    const flags = [];
    if (!finiteGeometry || !finiteTransforms) flags.push('nonfinite');
    if (constructMs > 1000) flags.push('slow-construction');
    if (percentile(costs, .95) > 16) flags.push('slow-cpu-update');
    if (drawCallsEstimate > 500) flags.push('many-draw-calls');
    if (renderedTriangles > 500000) flags.push('many-triangles');
    if (sceneObjectGrowth > 0) flags.push('scene-growth');
    if (newGeometryCount > 0) flags.push('new-geometry-during-playback');
    console.log(JSON.stringify({id, status: finiteGeometry && finiteTransforms ? 'screened' : 'failed', sampledPeriod: period, constructMs, updateP95Ms: percentile(costs, .95), updateMaxMs: Math.max(...costs), meshes, drawCallsEstimate, renderedTriangles: Math.round(renderedTriangles), geometryBytes, sceneObjectGrowth, newGeometryCount, finiteGeometry, finiteTransforms, sourceAnimationAvailable: root.userData.sourceAnimation?.available ?? null, flags}));
  } finally { disposeMovementModel(model); }
} else {
  for (const arg of args) if (!/^--(ids|batch|out|timeout-ms)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const batchName = value('--batch');
  if (batchName && !movementBatches.some(batch => batch.key === batchName)) throw new Error(`Unknown batch: ${batchName}`);
  const ids = value('--ids') ? expandIds(value('--ids')) : [...assignments.keys()].sort((a, b) => a - b).filter(id => !batchName || assignments.get(id).key === batchName);
  if (ids.some(id => !assignments.has(id))) throw new Error('This queue covers movements 183–507.');
  const timeout = Number(value('--timeout-ms') ?? 20000);
  if (!Number.isFinite(timeout) || timeout < 1) throw new Error('Timeout must be positive.');
  const out = resolve(value('--out') ?? '/dev/shm/507-movement-screen.json');
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'Authored factory construction and 49 CPU update samples; excludes imports, GPU rendering, browser loading, contact correctness and source fit. Screening is not qualification.',
    thresholds: {constructMs: 1000, updateP95Ms: 16, drawCallsEstimate: 500, renderedTriangles: 500000},
    batches: movementBatches,
    movements: [],
  };
  await mkdir(dirname(out), {recursive: true});
  for (const id of ids) {
    let result;
    try {
      const {stdout} = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), `--worker=${id}`], {timeout, maxBuffer: 1024 * 1024});
      result = JSON.parse(stdout.trim().split('\n').at(-1));
    } catch (error) {
      result = {id, status: error.killed ? 'timeout' : 'error', flags: [error.killed ? 'timeout' : 'error'], error: String(error.stderr || error.message).slice(0, 1200)};
    }
    report.movements.push({...result, title: catalog[id - 1].title, batch: assignments.get(id).key});
    await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${id}: ${result.status}${result.flags?.length ? ` (${result.flags.join(', ')})` : ''}`);
  }
  console.log(`Saved ${report.movements.length} screens to ${out}`);
  if (report.movements.some(m => ['error', 'failed', 'timeout'].includes(m.status))) process.exitCode = 1;
}
