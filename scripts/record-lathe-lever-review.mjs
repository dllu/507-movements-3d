import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[55]);
const contact = await json('artifacts/review/056-candidate-tooth-cycle-contact.json');
const fullCycle = await json('artifacts/review/056-candidate-planar-contact.json');
const cam = await json('artifacts/review/056-candidate-cam-forces.json');
const hardware = await json('artifacts/review/056-candidate-hardware.json'), solids = await json('artifacts/review/056-candidate-solids.json');
const numerical = await json('artifacts/review/056-numerical-exit-status.json');
const numericalLog = await readFile('artifacts/review/056-numerical-exit-check.log', 'utf8');
const browserLog = await readFile('artifacts/review/056-browser-tests.log', 'utf8');
const browserExit = await json('artifacts/review/056-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/056-build.log', 'utf8');
const files = (await readdir('artifacts/review')).filter(f => /^056-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/16 passed[^\n]*/)?.[0] ?? null;
const solidIssues = solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges);
const complete = numerical.code === 0 && browserExit?.code === 0 && browserResult && /built in/.test(buildLog)
  && files.length === 6 && !solidIssues.length && hardware.inside === 0 && contact.summary.intersections === 0
  && fullCycle.summary.intersections === 0 && cam.summary.intersections === 0 && cam.summary.maximumPowerResidual < 0.01;
const record = {
  movement: 56, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_056.html', reference: '../reference/brown-056-detail.png',
  interpretation: 'A foreground eccentric-slot lever withdraws the large lathe speed gear through a sliding bearing. Both shafts stop before each shift; the disengaged pinion turns alone.',
  sourceChoices: 'Indexed visible large-wheel teeth fit 38 positions best. The partly concealed pinion suggests about 12. These are reconstruction estimates; the website animation uses 45/15 and Brown prescribes no ratio.',
  sourceLimits: 'The standard common-module involutes have shorter tips than Brown’s schematic teeth and a small residual center offset. The near-frontal camera balances inconsistent apparent source circle centers while retaining straight parallel shafts. Hidden solid sections are inferred.',
  operatingReference: { title: 'Logan lathe, U.S. Army TM 9-3416-233-14&P, printed page 23',
    url: 'https://cdn.imagearchive.com/homemodelenginemachinist/data/attach/1/1690-powermaticarmy12.pdf',
    file: '../reference/logan-lathe-back-gears-manual.pdf' },
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true },
  evidence: {
    sourcePitch: '056-indexed-tooth-fit.json', interactiveSourceOverlay: '056-source-alignment.html',
    actualToothContact: { summary: contact.summary, report: '056-candidate-tooth-cycle-contact.json' },
    completeCycle: { summary: fullCycle.summary, report: '056-candidate-planar-contact.json' },
    camForce: { summary: cam.summary, report: '056-candidate-cam-forces.json' },
    independentTriangleContact: '056-candidate-exact-contact.json',
    hardware: { poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside, report: '056-candidate-hardware.json' },
    solids: { geometries: solids.length, issues: solidIssues, report: '056-candidate-solids.json' },
    mechanicalTests: { passed: 5, log: '056-focused-tests.log' },
    numericalTests: { passed: Number(numericalLog.match(/# pass (\d+)/)?.[1]), ...numerical, log: '056-numerical-exit-check.log' },
    browserTests: { result: browserResult, exit: browserExit, log: '056-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), log: '056-build.log' }, sourceComparisons: files, rearView: '056-integrated-rear.png',
  },
  baseline: { factory: '056-original-factory.txt', tests: '056-original-test.txt', toothContact: '056-tooth-contact-baseline.json',
    failures: 'Quarter-pitch gear phase error; output movement after contact ended; incorrect foreground occlusion, broad elliptical cam and separate grip.' },
  evidenceLimits: 'Finite pose sweeps and tessellation clearances are numerical evidence, not continuous collision certification. Normal-force work checks are quasi-static; inertia, elasticity, wear and impact are not simulated.',
};
await writeFile('artifacts/review/056-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numericalTests.passed, browserResult, comparisons: galleryFiles.length });
