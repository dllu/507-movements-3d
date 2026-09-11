import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[57]);
const contact = await json('artifacts/review/058-candidate-gear-contact.json');
const exact = await json('artifacts/review/058-candidate-exact-contact.json');
const hardware = await json('artifacts/review/058-candidate-hardware.json'), solids = await json('artifacts/review/058-candidate-solids.json');
const alignment = await json('artifacts/review/058-source-alignment.json');
const numerical = await json('artifacts/review/058-numerical-exit-status.json').catch(() => null);
const numericalLog = await readFile('artifacts/review/058-numerical-exit-check.log', 'utf8').catch(() => '');
const browserLog = await readFile('artifacts/review/058-browser-tests.log', 'utf8').catch(() => '');
const browserExit = await json('artifacts/review/058-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/058-build.log', 'utf8');
const files = (await readdir('artifacts/review')).filter(f => /^058-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/18 passed[^\n]*/)?.[0] ?? null;
const solidIssues = solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges);
const complete = numerical?.code === 0 && browserExit?.code === 0 && browserResult && /built in/.test(buildLog)
  && files.length === 6 && !solidIssues.length && hardware.inside === 0
  && contact.summary.every(v => v.intersections === 0 && v.minimumGap > 0.00002 && v.maximumGap < 0.000035 && v.maximumPowerResidual < 0.0025)
  && exact.rows.every(v => v.witness && v.distance > (v.kind === 'gear' ? 0.00002 : 0.00012)
    && v.distance < (v.kind === 'gear' ? 0.00004 : 0.00020));
const record = {
  movement: 58, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_058.html', reference: '../reference/brown-058-detail.png',
  interpretation: 'A broad upper drum drives a flat band traversing four equal lower pulleys. The rightmost is loose; the others drive a main shaft and two nested hollow shafts. Their three gear pairs share one output shaft, which back-drives the unselected input members.',
  sourceChoices: 'Source envelopes set pulley diameters, shaft centers, gear planes and axial widths. Compatible 17/39, 26/30 and 40/16 ordinary 20-degree involutes approximate the gear-stack proportions. Brown gives no tooth counts and has no official animation for this entry.',
  sourceLimits: 'A continuous flat band fills the engraving’s schematic torn-end interruption. Source shaft and pulley centers disagree slightly; the reconstruction keeps concentric shafts and records residuals. Stopped shifts, bearing mounts and axial retention are inferred or idealized.',
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true },
  evidence: {
    sourceMeasurements: '058-source-envelope-measurement.json', interactiveSourceOverlay: '058-source-alignment.html',
    sourceResiduals: alignment.rows.map(({ name, topResidual, bottomResidual }) => ({ name, topResidual, bottomResidual })),
    actualToothContact: { summary: contact.summary, report: '058-candidate-gear-contact.json' },
    independentTriangleContact: { report: '058-candidate-exact-contact.json', rows: exact.rows.length,
      minimumBeltGap: Math.min(...exact.rows.filter(v => v.kind !== 'gear').map(v => v.distance)) },
    hardware: { poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside, report: '058-candidate-hardware.json' },
    solids: { geometries: solids.length, issues: solidIssues, report: '058-candidate-solids.json' },
    focusedTests: { passed: 7, log: '058-focused-tests.log' },
    numericalTests: { passed: Number(numericalLog.match(/# pass (\d+)/)?.[1]) || null, exit: numerical, log: '058-numerical-exit-check.log' },
    browserTests: { result: browserResult, exit: browserExit, log: '058-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), log: '058-build.log' }, sourceComparisons: files,
    inspectedViews: 'All six integrated source/oblique frames, candidate rear and shift views, and the source overlay were visually inspected.',
  },
  baseline: { factory: '058-original-factory.txt', tests: '058-original-test.txt', toothContact: '058-tooth-contact-baseline.json', hardware: '058-hardware-baseline.json',
    failures: 'Incorrect tooth phases; nested shafts crossing unbored gear solids; a round band penetrating the driving tread and lower pulley flanges during traverse; small pulley diameters, compressed gear spacing and reversed source camera.' },
  evidenceLimits: 'Finite sweeps and tessellation clearances are numerical evidence, not arbitrary continuous collision certification. Pairwise normal-force power residual stays below 0.195 percent on both flanks. Bearing constraints, axial retention, stopped shifts and belt contact are idealized; inertia, elasticity, wear and friction are not solved.',
};
await writeFile('artifacts/review/058-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numericalTests.passed, browserResult, comparisons: galleryFiles.length });
