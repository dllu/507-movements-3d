import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const read = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await read('src/data/movements.json'), model = createMovementModel(catalog.movements[53]);
const map = await read('artifacts/review/054-candidate32-shifted-contact-map.json');
const exact = await read('artifacts/review/054-candidate32-shifted-loaded-exact-gap.json');
const forces = await read('artifacts/review/054-candidate32-captured-guide-forces.json');
const numerical = await readFile('artifacts/review/054-numerical-exit-check.log', 'utf8').catch(() => '');
const exitStatus = await read('artifacts/review/054-numerical-exit-status.json').catch(() => null);
const browser = await readFile('artifacts/review/054-browser-tests.log', 'utf8').catch(() => '');
const build = await readFile('artifacts/review/054-build.log', 'utf8');
const focused = await readFile('artifacts/review/054-mechanical-tests.log', 'utf8');
const browserResult = browser.match(/14 passed[^\n]*/)?.[0] ?? null;
const passCount = text => Number(text.match(/# pass (\d+)/)?.[1] ?? 0);
const files = (await readdir('artifacts/review')).filter(f => /^054-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const record = { movement: 54, status: exitStatus?.code === 0 && browserResult ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_054.html', reference: '../reference/brown-054-detail.png',
  interpretation: 'One continuously rotating radial pinion drives the two faces of a wheel with radial rungs. The crab captures its collar while transferring the input between faces. Four waisted spokes, the hub and the crab location follow Brown.',
  inference: 'The source stroke pitch supports 32 wheel positions. A four-tooth shifted involute pinion, one omitted rung, the generated rung sections and the opposing crab-guide faces are reconstruction choices. The source does not dimension those sections. The bearing beyond input shaft B is idealized.',
  geometry: model.root.userData.geometry,
  motion: { path: 'Geometric wheel/collar path lambda, with actual constant-speed input u=lambda+delta(lambda). The first-contact map is inverted to determine lambda.',
    idealConstraints: model.root.userData.idealConstraints, cycleMeaning: 'Two nearly complete wheel strokes and two crossovers, requiring sixteen input revolutions.',
    map: { nodes: map.nodes.length, queries: map.queries, phaseBackoff: map.phaseBackoff, interpolation: map.interpolation },
    forceModel: forces.constraints, forceSummary: forces.summary,
    forceLimits: 'Quasistatic compression under selected output and bearing drag. The small mesh clearances and tessellated normals account for a maximum 0.41% power residual in the recorded probe. Mass, elasticity, wear and impact dynamics are not simulated.' },
  camera: { source: model.cameraDirection.toArray(), complete: model.root.userData.fullCameraDirection.toArray(), fieldOfView: 17,
    groundHidden: true, shadowCameraHalfExtent: 2.2, shadowBias: -0.00003 },
  display: { ...model.root.userData.animationTiming, inputRevolutionsPerSecond: model.root.userData.geometry.inputSpeed
    * model.root.userData.animationTiming.playbackTimeScale / (2 * Math.PI) },
  evidence: { toothContact: await read('artifacts/review/054-candidate32-shifted-loaded-tooth-contact.json'),
    hardware: await read('artifacts/review/054-candidate32-captured-guide-hardware.json'),
    exactContact: { poses: exact.poses.length, minimumGap: Math.min(...exact.poses.map(v => v.distance)),
      maximumGap: Math.max(...exact.poses.map(v => v.distance)), report: '054-candidate32-shifted-loaded-exact-gap.json' },
    solids: { geometries: (await read('artifacts/review/054-candidate32-captured-guide-solids.json')).length,
      report: '054-candidate32-captured-guide-solids.json', checks: 'Closed oriented edges, positive volume, nonzero faces and all three corner normals of every triangle.' },
    forces: '054-candidate32-captured-guide-forces.json', focusedTests: { passed: passCount(focused), log: '054-mechanical-tests.log' },
    sharedGearRegression: { report: '054-spur-default-regression.json', existing048Tests: 8, shiftedProfileTests: 2 },
    numerical: { passed: passCount(numerical), exitStatus, log: '054-numerical-exit-check.log' },
    browser: { result: browserResult, log: '054-browser-tests.log' },
    build: { passed: /built in/.test(build), log: '054-build.log' }, sourceComparisons: files },
  baseline: { factory: '054-original-factory.txt', test: '054-original-test.txt', contact: '054-contact-baseline.json',
    observations: 'Axial pins intersected the radial input pinion. Open tubular rims, radial box webs and the oversized shaft also disagreed with the engraving. The baseline probe found 38,821 penetrating samples, up to 0.213868 deep.' },
  rejectedCandidates: { standardFourToothPinion: 'A grazing first-contact jump prevented continuous timing; see 054-candidate32-engagement-step-independent.json.',
    singleGuideFace: 'A force check required tension in part of each reversal, including with zero bearing drag. A physical opposing face was added and independently checked.' },
  evidenceLimits: 'Finite surface and contact sampling is independent numerical evidence, not a continuous collision proof or certification of the full catalogue.' };
await writeFile('artifacts/review/054-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const galleryPath = 'artifacts/review/index.html', existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir('artifacts/review')).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix = existing.slice(0, existing.indexOf('<div class="grid">') + '<div class="grid">'.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: record.evidence.numerical, browser: browserResult, galleryComparisons: galleryFiles.length });
