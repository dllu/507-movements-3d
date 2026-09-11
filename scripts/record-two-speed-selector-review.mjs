import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[58]);
const contact = await json('artifacts/review/059-candidate-gear-contact.json');
const exact = await json('artifacts/review/059-candidate-exact-contact.json');
const hardware = await json('artifacts/review/059-candidate-hardware.json'), solids = await json('artifacts/review/059-candidate-solids.json');
const alignment = await json('artifacts/review/059-source-alignment.json');
const numerical = await json('artifacts/review/059-numerical-exit-status.json').catch(() => null);
const numericalLog = await readFile('artifacts/review/059-numerical-exit-check.log', 'utf8').catch(() => '');
const browserLog = await readFile('artifacts/review/059-browser-tests.log', 'utf8').catch(() => '');
const browserExit = await json('artifacts/review/059-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/059-build.log', 'utf8');
const files = (await readdir('artifacts/review')).filter(f => /^059-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/19 passed[^\n]*/)?.[0] ?? null;
const solidIssues = solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges);
const complete = numerical?.code === 0 && browserExit?.code === 0 && browserResult && /built in/.test(buildLog)
  && files.length === 6 && !solidIssues.length && hardware.inside === 0
  && contact.summary.every(v => v.intersections === 0 && v.minimumGap > 0.00002 && v.maximumGap < 0.000035 && v.maximumPowerResidual < 0.004)
  && exact.rows.every(v => v.witness && v.distance > (v.kind === 'gear' ? 0.00002 : 0.00012)
    && v.distance < (v.kind === 'gear' ? 0.00004 : 0.00020));
const record = {
  movement: 59, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_059.html', reference: '../reference/brown-059-detail.png',
  interpretation: 'A broad upper drum drives a flat band traversing three equal lower pulleys. The leftmost is loose; the middle drives the main shaft and source-left small gear, while the rightmost drives a hollow shaft and source-right large gear. Both output gears share one shaft, which back-drives the unselected input member.',
  sourceChoices: 'Source envelopes set pulley diameters, shaft centers, gear planes and axial widths. Compatible 12/42 and 45/9 ordinary 30-degree involutes approximate the gear-stack proportions. A 20-degree nine-tooth option lost working contact. Brown gives no tooth counts or pressure angle and has no official animation for this entry.',
  sourceLimits: 'A continuous flat band fills the engraving’s schematic torn-end interruption. Source shaft and pulley centers disagree slightly; the reconstruction keeps concentric shafts and records residuals. Stopped shifts, bearing mounts and axial retention are inferred or idealized.',
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true },
  evidence: {
    sourceMeasurements: '059-source-envelope-measurement.json', profileOptions: '059-profile-options.json', interactiveSourceOverlay: '059-source-alignment.html',
    sourceResiduals: alignment.rows.map(({ name, topResidual, bottomResidual }) => ({ name, topResidual, bottomResidual })),
    actualToothContact: { summary: contact.summary, report: '059-candidate-gear-contact.json' },
    independentTriangleContact: { report: '059-candidate-exact-contact.json', rows: exact.rows.length,
      minimumBeltGap: Math.min(...exact.rows.filter(v => v.kind !== 'gear').map(v => v.distance)) },
    hardware: { poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside, report: '059-candidate-hardware.json' },
    solids: { geometries: solids.length, issues: solidIssues, report: '059-candidate-solids.json' },
    focusedTests: { passed: 5, log: '059-focused-tests.log' },
    numericalTests: { passed: Number(numericalLog.match(/# pass (\d+)/)?.[1]) || null, exit: numerical, log: '059-numerical-exit-check.log' },
    browserTests: { result: browserResult, exit: browserExit, log: '059-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), log: '059-build.log' }, sourceComparisons: files,
    inspectedViews: 'All six integrated source/oblique frames, candidate rear and shift views, and the source overlay were visually inspected.',
  },
  baseline: { factory: '059-original-factory.txt', tests: '059-original-test.txt', toothContact: '059-tooth-contact-baseline.json', hardware: '059-hardware-baseline.json',
    failures: 'Incorrect tooth phases; a round band penetrating the driving treads and lower pulley flanges during traverse; undersized pulleys, incorrect gear proportions and reversed source camera.' },
  correctedDiagnostics: {
    capTriangulation: { report: '059-candidate-solids-initial.json', correction: 'Snap only axis coordinate residues below 1e-14 before Float32 contour cleanup; the corrected 13 solids are all closed and nondegenerate.' },
    toothSweep: { report: '059-candidate-gear-contact-short-sweep.json', correction: 'Use the quick dwell, which reaches every phase of one complete output-tooth period for both pairs. The earlier slow dwell covered only 9/14 of a tooth of the nine-tooth output.' },
  },
  evidenceLimits: 'Finite sweeps and tessellation clearances are numerical evidence, not arbitrary continuous collision certification. Pairwise normal-force power residual stays below 0.317 percent on both flanks. Bearing constraints, axial retention, stopped shifts and belt contact are idealized; inertia, elasticity, wear and friction are not solved.',
};
await writeFile('artifacts/review/059-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numericalTests.passed, browserResult, comparisons: galleryFiles.length });
