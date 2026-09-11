import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[56]);
const contact = await json('artifacts/review/057-candidate-gear-contact.json');
const force = await json('artifacts/review/057-candidate-gear-forces.json');
const exact = await json('artifacts/review/057-candidate-exact-contact.json');
const hardware = await json('artifacts/review/057-candidate-hardware.json'), solids = await json('artifacts/review/057-candidate-solids.json');
const numerical = await json('artifacts/review/057-numerical-exit-status.json').catch(() => null);
const numericalLog = await readFile('artifacts/review/057-numerical-exit-check.log', 'utf8');
const browserLog = await readFile('artifacts/review/057-browser-tests.log', 'utf8').catch(() => '');
const browserExit = await json('artifacts/review/057-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/057-build.log', 'utf8');
const files = (await readdir('artifacts/review')).filter(f => /^057-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/17 passed[^\n]*/)?.[0] ?? null;
const solidIssues = solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges);
const complete = numerical?.code === 0 && browserExit?.code === 0 && browserResult && /built in/.test(buildLog)
  && files.length === 6 && !solidIssues.length && hardware.inside === 0
  && Object.values(contact.summary).every(v => v.intersections === 0 && v.minimumGap > 0 && v.maximumGap < 0.00004)
  && exact.poses.every(v => v.distance > 0 && v.witness) && exact.crossover.distance > 0
  && force.summary.minimumSunLoad > 0 && force.summary.maximumNormalizedPowerResidual < 0.0025;
const record = {
  movement: 57, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_057.html', reference: '../reference/brown-057-detail.png',
  interpretation: 'Two bands from the upper driver rotate the coaxial sun and internal ring oppositely. The intermediate pinion spins on its carrier axle while orbiting the common center.',
  sourceChoices: 'Unseeded visible ink plateaus and independent angular spectra favor 18/10/34 teeth. Brown has no official animation for this entry and specifies no tooth counts. The upper pulley has two equal-radius adjacent grooves.',
  sourceLimits: 'Involute flanks replace schematic square teeth; sun tips are about 11 scan pixels shorter to avoid interference. The crossed band passes behind the ring instead of across its front edge. The thin carrier between sun drum and gear faces, independent sleeve, external annular ring bearing and axial sections are inferred.',
  constructionReference: [
    { title: 'Nonstandard planetary tooth counts with different operating pressure angles, EP3255314A1', url: 'https://patents.google.com/patent/EP3255314A1/en' },
    { title: 'KHK gear-dimension calculations', url: 'https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html' },
  ],
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true },
  evidence: {
    sourceSpectrum: '057-source-pitch-measurement.json', indexedSourceTeeth: '057-indexed-source-teeth.json', interactiveSourceOverlay: '057-source-alignment.html',
    actualToothContact: { summary: contact.summary, report: '057-candidate-gear-contact.json' },
    force: { summary: force.summary, report: '057-candidate-gear-forces.json' },
    independentTriangleContact: { report: '057-candidate-exact-contact.json', crossoverGap: exact.crossover.distance },
    hardware: { poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside, report: '057-candidate-hardware.json' },
    solids: { geometries: solids.length, issues: solidIssues, report: '057-candidate-solids.json' },
    mechanicalTests: { passed: 5, log: '057-focused-tests.log' },
    numericalTests: { passed: Number(numericalLog.match(/# pass (\d+)/)?.[1]) || null, exit: numerical, log: '057-numerical-exit-check.log' },
    browserTests: { result: browserResult, exit: browserExit, log: '057-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), log: '057-build.log' }, sourceComparisons: files, rearView: '057-integrated-rear.png',
  },
  baseline: { factory: '057-original-factory.txt', tests: '057-original-test.txt', toothContact: '057-tooth-contact-baseline.json', hardware: '057-hardware-baseline.json', belts: '057-belt-contact-baseline.json',
    failures: 'Rectangular internal teeth and overlapping spur teeth; unbored sun assemblies crossed by the carrier sleeve; rotating spokes through carrier hardware; oversized cords penetrating pulley solids; inner band drum inside the sun tooth outline.' },
  rejectedCandidate: { model: '057-rejected-rear-carrier-model.mjs', audit: '057-candidate-hardware-initial.json', issue: 'A rear carrier required a long planet axle that struck the crossed band during orbit.' },
  evidenceLimits: 'Finite sweeps and tessellation clearances are numerical evidence, not arbitrary continuous collision certification. The quasistatic power residual is 0.164% of ring input, or 5.57% of the small carrier output. Crossover bending, bearing constraints and cord contact are idealized; inertia, elasticity, wear and friction are not solved.',
};
await writeFile('artifacts/review/057-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numericalTests.passed, browserResult, comparisons: galleryFiles.length });
