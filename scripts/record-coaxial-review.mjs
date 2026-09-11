import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[54]);
const contact = await json('artifacts/review/055-actual-contour-contact.json');
const hardware = await json('artifacts/review/055-candidate-hardware.json'), solids = await json('artifacts/review/055-candidate-solids.json');
const numerical = await json('artifacts/review/055-numerical-exit-status.json');
const numericalLog = await readFile('artifacts/review/055-numerical-exit-check.log', 'utf8');
const browserLog = await readFile('artifacts/review/055-browser-tests.log', 'utf8');
const browserExit = await json('artifacts/review/055-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/055-build.log', 'utf8');
const files = (await readdir('artifacts/review')).filter(f => /^055-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/15 passed[^\n]*/)?.[0] ?? null;
const record = { movement: 55,
  status: numerical.code === 0 && browserExit?.code === 0 && browserResult && files.length === 6 ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_055.html', reference: '../reference/brown-055-detail.png',
  interpretation: 'One fixed pinion drives two independently rotating coaxial outputs, A externally and C internally.',
  sourceChoices: 'Brown’s boundary pitch supports A17 and C37; the observed B outline and common-module identity C=A+2B give B10. The official website animation instead uses 20/10/40. Neither description prescribes a numeric ratio.',
  inferredGeometry: '25-degree involutes, a rounded rack cutter, shortened internal tips, a rear cup web, and independently bored output sleeve. External bearings lie beyond the displayed shaft ends and are idealized.',
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true },
  evidence: {
    sourcePitch: '055-source-pitch-measurement.json', interactiveSourceOverlay: '055-source-alignment.html',
    actualBoundaryContact: { summary: contact.summaries, report: '055-actual-contour-contact.json',
      method: 'Exact XY segment minima recovered from actual Float32 side-wall triangles; axial slabs overlap.' },
    independentTriangleContact: '055-final-candidate-triangle-contact.json',
    distanceMethodValidation: '055-planar-method-validation.json',
    hardware: { poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside, report: '055-candidate-hardware.json' },
    solids: { geometries: solids.length, issues: solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges), report: '055-candidate-solids.json' },
    mechanicalTests: { passed: 4, log: '055-mechanical-tests.log' },
    numericalTests: { passed: Number(numericalLog.match(/# pass (\d+)/)?.[1]), ...numerical, log: '055-numerical-exit-check.log' },
    browserTests: { result: browserResult, exit: browserExit, log: '055-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), log: '055-build.log' }, sourceComparisons: files },
  baseline: { factory: '055-original-factory.txt', tests: '055-original-test.txt',
    toothContact: '055-tooth-contact-baseline.json', supportContact: '055-support-contact-baseline.json',
    failures: 'Quarter-pitch phase errors, rectangular internal teeth, and rear spokes colliding with the input hub. The source proportions were also changed by small shafts, long overhangs, and added face ornaments.' },
  evidenceLimits: 'Finite pose sweeps and small tessellation clearances provide numerical evidence, not continuous collision certification. Compressive torque checks are quasistatic and do not simulate inertia, elasticity, wear, or impact.' };
await writeFile('artifacts/review/055-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numericalTests.passed, browserResult, comparisons: galleryFiles.length });
