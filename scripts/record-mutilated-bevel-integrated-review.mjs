import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(base + name + '.json', 'utf8'));
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const hashes = await json('074-verification-source-hashes');
for (const [file, sha256] of Object.entries(hashes)) {
  if (await hash(file) !== sha256) throw new Error('Verified production source changed: ' + file);
}
const checkpoint = await json('074-candidate-checkpoint'), captures = await json('074-integrated-captures');
const bake = await json('074-contact-spline-bake'), skins = await json('074-contact-spline-skins');
const parity = await json('074-exact-production-parity'), solids = await json('074-normal-refined-solids');
const forces = await json('074-fitted-contact-forces'), hardware = await json('074-fitted-hardware');
if (!bake.finished || bake.maximumValidationError > 4e-7 || skins.inside || skins.maximumContactDistance > 1e-6
  || parity.failures.length || parity.maximumPoseError || parity.maximumStateError
  || solids.issues.length || solids.detached.length || forces.issues.length || hardware.inside) {
  throw new Error('Mechanical acceptance report failed');
}
if (captures.captures.length !== 14 || Object.values(captures.checks).some(value => value !== true)) {
  throw new Error('Integrated view or UI checks failed');
}
for (const frame of captures.captures) {
  if (!frame.inspected || await hash(frame.file) !== frame.sha256) throw new Error('Uninspected or changed frame: ' + frame.file);
}
const names = ['contact-spline-bake', 'contact-spline-skins', 'exact-production-parity', 'display-measurement',
  'focused-tests', 'numerical', 'build', 'final-integrated-capture', 'browser-tests'];
const exits = {};
for (const name of names) {
  exits[name] = await json('074-' + name + '-exit-status');
  if (exits[name].code !== 0 || exits[name].signal !== null) throw new Error('Failed verification: ' + name);
}
for (const [name, count] of [['focused-tests', 7], ['numerical', 3056]]) {
  const log = await readFile(base + '074-' + name + '.log', 'utf8');
  if (!new RegExp('^# pass ' + count + '$', 'm').test(log) || !/^# fail 0$/m.test(log)) throw new Error('Test count changed');
}
if (!/\b31 passed\b/.test(await readFile(base + '074-browser-tests.log', 'utf8'))) throw new Error('Browser verification incomplete');
const restored = await json('074-browser-regression-captures/manifest');
const prior = await json('074-prior-browser-evidence/manifest');
if (!restored.priorEvidenceRestored || restored.rows.length !== 18) throw new Error('Historical screenshots not restored');
for (const frame of prior.frames) {
  if (await hash(base + frame.file) !== frame.sha256) throw new Error('Changed historical screenshot: ' + frame.file);
}
const reports = {};
for (const name of ['074-candidate-checkpoint', '074-normal-refined-solids', '074-shading-refinement',
  '074-contact-spline-bake', '074-contact-spline-skins', '074-exact-production-parity',
  '074-fitted-hardware', '074-fitted-contact-forces', '074-integrated-captures']) reports[name + '.json'] = await hash(base + name + '.json');
const sources = [];
for (const file of ['scripts/export-mutilated-bevel-profile.mjs', 'scripts/bake-mutilated-bevel-contact-spline.mjs',
  'scripts/lib/mutilated-bevel-contact-spline.mjs', 'scripts/lib/mutilated-bevel-runtime-candidate.mjs',
  'scripts/probe-mutilated-bevel-spline-skins.mjs', 'scripts/probe-mutilated-bevel-production-parity.mjs',
  'scripts/capture-mutilated-bevel-integrated.mjs', 'scripts/record-mutilated-bevel-integrated-review.mjs']) {
  const archive = base + '074-integrated-review-source-' + sources.length + '.txt';
  await writeFile(archive, await readFile(file), { flag: 'wx' });
  sources.push({ file, archive, sha256: await hash(file) });
}
const report = { movement: 74, status: 'rebuilt-and-verified', productionChanged: true,
  verificationHashes: '074-verification-source-hashes.json', verifiedFiles: Object.keys(hashes).length,
  geometry: { solids: 87, sourceFit: checkpoint.sourceFit, parameters: bake.parameters },
  contact: { solvedForcePoses: forces.rows.length, minimumDrivingMoment: forces.minimumDrivingMoment,
    hardwareChecks: hardware.checks, hardwareInside: hardware.inside,
    splineNodes: bake.profile.nodes.length, independentValidationPoses: bake.validationPoses,
    maximumAngularError: bake.maximumValidationError, interpolatedSkinChecks: skins.checks,
    interpolatedSkinPoses: skins.poses, minimumSampledGap: skins.minimumGap,
    maximumContactDistance: skins.maximumContactDistance },
  parity: { meshes: parity.meshes, poses: parity.poses, maximumPoseError: parity.maximumPoseError,
    maximumStateError: parity.maximumStateError },
  timing: { ...captures.timing, analyticallyBoundedPeakOutputSpeed: parity.maximumOutputSpeed },
  physicalModel: 'Quasistatic compressive tooth contact, ideal bearing friction holding each released output, reconstructed 32/40 tooth counts and four relieved sector-end teeth. No positive dwell lock or inertial dynamics. Back-cone involutes approximate straight bevel flanks; sampled clearance is not a continuous mathematical certificate.',
  views: captures.captures, checks: captures.checks, reports, sources, exits,
  regression: { focused: 7, numerical: 3056, browser: 31, all507Rendered: true },
  preservedIntegrationFailures: [
    { report: '074-production-parity.json', reason: 'JSON discarded negative zero in four analytic normal buffers. JavaScript numeric export now preserves every Float32 byte.' },
    { report: '074-initial-integrated-capture/manifest.json', reason: 'Same-document navigation kept the comparison page with a detached app mount.' },
    { report: '074-reloaded-integrated-capture/manifest.json', reason: 'The intermediate hash change still invoked the detached router. A fresh page fixes the capture harness; production source did not change.' },
  ], remaining: [] };
await writeFile(base + '074-integrated-checkpoint.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const reconstruction = await json('074-reconstruction');
Object.assign(reconstruction, { status: report.status, productionChanged: true, mechanicsPassed: true,
  integration: '074-integrated-checkpoint.json', verificationHashes: report.verificationHashes, remaining: [] });
await writeFile(base + '074-reconstruction.json', JSON.stringify(reconstruction, null, 2) + '\n');
const gallery = base + 'index.html', html = await readFile(gallery, 'utf8'), marker = '<div class="grid">';
const files = (await readdir(base)).filter(file => /^074-integrated-.*\.png$/.test(file)).sort();
if (!html.includes(marker)) throw new Error('Review gallery marker missing');
if (!html.includes('074-integrated-source.png')) await writeFile(gallery, html.replace(marker, marker + '\n'
  + files.map(file => `<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n')));
console.log({ status: report.status, verifiedFiles: report.verifiedFiles, views: report.views.length, regression: report.regression });
