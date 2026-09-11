import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[59]);
const exact = await json('artifacts/review/060-candidate-exact-contact.json');
const hardware = await json('artifacts/review/060-candidate-hardware.json');
const solids = await json('artifacts/review/060-candidate-solids.json');
const motion = await json('artifacts/review/060-candidate-motion-check.json');
const alignment = await json('artifacts/review/060-source-alignment.json');
const numerical = await json('artifacts/review/060-numerical-exit-status.json').catch(() => null);
const numericalLog = await readFile('artifacts/review/060-numerical-exit-check.log', 'utf8').catch(() => '');
const browserLog = await readFile('artifacts/review/060-browser-tests.log', 'utf8').catch(() => '');
const browserExit = await json('artifacts/review/060-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/060-build.log', 'utf8');
const focusedLog = await readFile('artifacts/review/060-focused-tests.log', 'utf8');
const files = (await readdir('artifacts/review')).filter(f => /^060-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/20 passed[^\n]*/)?.[0] ?? null;
const solidIssues = solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges);
const complete = numerical?.code === 0 && browserExit?.code === 0 && browserResult && /built in/.test(buildLog)
  && /# pass 5\n/.test(focusedLog) && files.length === 6 && !solidIssues.length && hardware.inside === 0
  && exact.rows.length === 24 && exact.rows.every(v => v.witness && v.distance > 0.00012 && v.distance < 0.00020)
  && motion.maximumRelativeNeutralSlip < 1e-9 && motion.checkedStoppedTraversals >= 2;
const record = {
  movement: 60, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_060.html', reference: '../reference/brown-060-detail.png',
  interpretation: 'Two unequal upper pulleys share a driver shaft. Both flat bands remain installed over four equal lower pulleys; the outer two are loose and the inner two fixed to the output shaft. Both bands shift right to select the large-pulley quick ratio, then left to return to the small-pulley slow ratio.',
  sourceChoices: 'Measured side envelopes set radii, shaft spacing, axial widths and the exposed shaft gap between the two lower banks. The source uses a negative-x side elevation and shows interrupted flat bands. No official animation is available.',
  sourceLimits: 'Physically concentric pulleys replace slightly inconsistent drawn shaft and pulley centers. The measured seven-pixel envelope bound covers pulley bodies and shafts, not schematic band arches or torn-end marks. Stopped shifts, bearing mounts and axial retention are inferred or idealized.',
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true },
  evidence: {
    sourceMeasurements: '060-source-envelope-measurement.json', interactiveSourceOverlay: '060-source-alignment.html',
    sourceResiduals: alignment.rows.map(({ name, topResidual, bottomResidual }) => ({ name, topResidual, bottomResidual })),
    independentTriangleContact: { report: '060-candidate-exact-contact.json', rows: exact.rows.length,
      minimumGap: Math.min(...exact.rows.map(v => v.distance)), maximumGap: Math.max(...exact.rows.map(v => v.distance)) },
    hardware: { poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside, report: '060-candidate-hardware.json' },
    solids: { geometries: solids.length, issues: solidIssues, report: '060-candidate-solids.json' },
    motion: { ...motion, report: '060-candidate-motion-check.json' },
    focusedTests: { passed: Number(focusedLog.match(/# pass (\d+)/)?.[1]) || null, log: '060-focused-tests.log' },
    numericalTests: { passed: Number(numericalLog.match(/# pass (\d+)/)?.[1]) || null, exit: numerical, log: '060-numerical-exit-check.log' },
    browserTests: { result: browserResult, exit: browserExit, log: '060-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), log: '060-build.log' }, sourceComparisons: files,
    inspectedViews: 'All six integrated source/oblique frames, candidate rear and shift views, and the source overlay were visually inspected.',
  },
  baseline: { factory: '060-original-factory.txt', tests: '060-original-test.txt', hardware: '060-hardware-baseline.json',
    failures: 'A round band penetrates driving treads and lower torus flanges; lower pulleys are undersized and the bank gap compressed. Camera reverses source ordering. Added supports and ground are absent from the source.' },
  renderingInvestigation: 'Bias variants and isolated cast-shadow images show the conspicuous blue-cap patches are shadows cast by bands and other pulleys. The face has uniform normals and color and shades uniformly without cast shadows. The candidate harness was corrected to honor model shadow extent five. Shared renderer and production lighting are unchanged.',
  evidenceLimits: 'Finite sweeps and tessellation clearances are numerical evidence, not arbitrary continuous collision certification. Belt neutral-fiber motion is constrained; friction, elasticity and inertia are not solved. Both shafts and axial retention have ideal external constraints.',
};
await writeFile('artifacts/review/060-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numericalTests.passed, browserResult, comparisons: galleryFiles.length });
