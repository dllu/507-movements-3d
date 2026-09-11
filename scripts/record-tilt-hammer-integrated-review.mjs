import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const directory = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(directory + name + '.json', 'utf8'));
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const hashes = await json('072-verification-source-hashes');
for (const [file, sha] of Object.entries(hashes))
  if (await digest(file) !== sha) throw new Error('Verification source changed: ' + file);
const checkpoint = await json('072-candidate-checkpoint'), exported = await json('072-runtime-export');
for (const [file, sha] of Object.entries(checkpoint.sources))
  if (await digest(file) !== sha || exported.candidateSources[file] !== sha) throw new Error('Candidate source changed: ' + file);
if (await digest(exported.file) !== exported.sha256) throw new Error('Exported profile changed');
const names = ['candidate-hardware', 'candidate-solids', 'final-candidate-contact-forces', 'refined-energy',
  'candidate-source-fit', 'runtime-export', 'integrated-equivalence', 'display-measurement',
  'focused-tests', 'numerical', 'build', 'integrated-capture', 'browser-tests'];
const exits = Object.fromEntries(await Promise.all(names.map(async name => [name, await json('072-' + name + '-exit-status')])));
for (const [name, exit] of Object.entries(exits))
  if (exit.code !== 0 || exit.signal !== null) throw new Error('Verification failed: ' + name);
for (const [name, count] of [['focused-tests', 16], ['numerical', 3050]]) {
  const log = await readFile(directory + '072-' + name + '.log', 'utf8');
  if (!new RegExp('^# pass ' + count + '$', 'm').test(log) || !/^# fail 0$/m.test(log)) throw new Error('Unexpected test result: ' + name);
}
if (!/\b31 passed\b/.test(await readFile(directory + '072-browser-tests.log', 'utf8'))) throw new Error('Browser pass count differs');
const hardware = await json('072-candidate-hardware'), solids = await json('072-candidate-solids');
const forces = await json('072-final-candidate-contact-forces'), energy = await json('072-refined-energy');
const equivalence = await json('072-integrated-equivalence');
if (hardware.inside || hardware.checks !== 392126508 || solids.issues.length || solids.rows.length !== 15
  || forces.failed.length || forces.poses !== 192 || energy.failures.length || equivalence.failures.length
  || !equivalence.registryChecked || equivalence.meshes.length !== 15 || equivalence.poses !== 10076)
  throw new Error('Mechanical evidence differs from the audited candidate');
const integrated = await json('072-integrated-captures'), candidate = await json('072-candidate-captures');
const inspection = await json('072-capture-inspection');
if (integrated.captures.length !== 11 || candidate.captures.length !== 9 || inspection.uiFrames.length !== 2)
  throw new Error('Missing inspected views');
for (const frame of [...integrated.captures, ...candidate.captures, ...inspection.uiFrames])
  if (!frame.inspected || await digest(frame.file) !== frame.sha256) throw new Error('Changed or uninspected frame: ' + frame.file);
const restored = await json('072-browser-regression-captures/manifest');
if (!restored.priorEvidenceRestored || restored.rows.length !== 16) throw new Error('Historical UI evidence has not been restored');
const prior = await json('072-prior-browser-evidence/manifest');
for (const frame of prior.frames)
  if (await digest(directory + frame.file) !== frame.sha256) throw new Error('Historical UI frame changed: ' + frame.file);
const record = await json('072-reconstruction');
for (const frame of record.inspection)
  if (!frame.inspected || await digest(directory + frame.file) !== frame.sha256) throw new Error('Baseline or overlay changed');
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[71]), timing = model.root.userData.animationTiming;
const { events, parameters: p } = model.motion;
record.status = 'rebuilt-and-verified'; record.productionChanged = true; record.mechanicsPassed = true;
delete record.verifiedProductionFiles;
record.verificationHashes = '072-verification-source-hashes.json'; record.verifiedFileCount = Object.keys(hashes).length;
record.reconstruction = {
  factory: 'src/simulation/tilt-hammer.js', motion: 'src/simulation/tilt-hammer-motion.js', profile: exported.file,
  solids: 15, gravityKnots: exported.fallKnots, initialTime: p.initialTime,
  physicalModel: 'Uniform-density rigid hammer with fixed ideal rear pivot, prescribed cam speed, compressive cam contact, gravity flight, inelastic pickup and landing, and a rigid undeformed workpiece. The regulated motor may absorb energy near release.',
  runtime: 'Precomputed source contours and converged gravity knots; exact circle contact and derivatives. No runtime polygon union, event search or numerical integration.',
};
record.integration = { export: '072-runtime-export.json', equivalence: '072-integrated-equivalence.json',
  meshes: equivalence.meshes.length, poses: equivalence.poses, inspectedTransforms: equivalence.transforms.length,
  maximumErrors: equivalence.maxima, qualification: equivalence.qualification };
record.animationTiming = { ...timing, fullInputTurnDisplaySeconds: 4 * timing.displayCycleDuration,
  crestToImpactDisplaySeconds: (events.landing.time - events.crest.time) / timing.playbackTimeScale,
  freeFallDisplaySeconds: (events.landing.time - events.release.time) / timing.playbackTimeScale };
record.integratedCaptures = '072-integrated-captures.json'; record.integratedInspection = inspection;
record.regression = { focused: { passed: 16, exit: exits['focused-tests'] }, numerical: { passed: 3050, exit: exits.numerical },
  build: { exit: exits.build }, browser: { passed: 31, exit: exits['browser-tests'] }, exits };
record.preservedFailures.push({ report: '072-runtime-equivalence.json',
  reason: 'An exact flank/tip join was assigned to the opposite curvature branch after time subtraction. Snapping the join angle and matching its boundary convention resolved acceleration equivalence; all mesh buffers and positions already agreed.' });
record.remaining = [];
await writeFile(directory + '072-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const existing = await readFile(directory + 'index.html', 'utf8'), marker = '<div class="grid">';
if (!existing.includes(marker)) throw new Error('Missing gallery marker');
const files = (await readdir(directory)).filter(file => /^(?:\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+|070-integrated-(?:source|section|oblique|rear|entry|first-corner|tip-side|release|rim-entry|locked)|072-(?:candidate|integrated)-(?:source|oblique|rear|pickup|lifting|flank-end|crest|release|fall|landing|dwell))\.png$/.test(file)).sort();
await writeFile(directory + 'index.html', existing.slice(0, existing.indexOf(marker) + marker.length) + '\n'
  + files.map(file => `<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, verifiedFiles: record.verifiedFileCount, focused: 16, numerical: 3050, browser: 31,
  integratedFrames: integrated.captures.length, uiFrames: inspection.uiFrames.length, comparisons: files.length });
