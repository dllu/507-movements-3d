import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const directory = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(directory + name + '.json', 'utf8'));
const optional = async name => { try { return await json(name); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const pass = exit => exit?.code === 0 && exit.signal === null;
const hashes = await json('069-verification-source-hashes');
for (const [file, expected] of Object.entries(hashes)) {
  if (await digest(file) !== expected) throw new Error('Verification source changed: ' + file);
}
const record = await json('069-reconstruction'), inspection = await optional('069-capture-inspection');
const candidate = await json('069-lock-event-candidate-captures');
for (const frame of [...record.baselineCaptures, ...(inspection?.frames ?? []), ...(inspection?.uiFrames ?? [])]) {
  if (!frame.inspected || await digest(directory + frame.file) !== frame.sha256) throw new Error('Inspected frame changed: ' + frame.file);
}
for (const frame of candidate.captures) {
  if (!frame.inspected || await digest(frame.file) !== frame.sha256) throw new Error('Candidate frame changed');
}
const hardware = await json('069-lock-event-hardware'), locking = await json('069-lock-event-locking');
const forces = await json('069-lock-event-contact-cones'), solids = await json('069-balanced-solids-retry1');
const generated = await json('069-balanced-profile'), event = await json('069-final-lock-event');
const source = await json('069-all-readings-source-fit'), equivalence = await json('069-integrated-candidate-equivalence');
const exitNames = ['lock-event-hardware', 'lock-event-locking', 'lock-event-contact-cones', 'balanced-solids-retry1',
  'final-lock-event', 'balanced-profile-generation', 'integrated-source-capture', 'integrated-full-capture',
  'all-readings-source-fit', 'display-profile', 'integration'];
const exits = Object.fromEntries(await Promise.all(exitNames.map(async name => [name, await optional(`069-${name}-exit-status`)])));
const mechanics = Object.values(exits).every(pass) && hardware.poses === 86 && hardware.pairs.length === 9
  && hardware.checks === 38176776 && hardware.inside === 0 && solids.rows.length === 6 && solids.issues.length === 0
  && locking.poses === 60 && locking.issues.length === 0
  && locking.rows.every(row => row.allowed.inside === 0 && row.blocked.inside > 0)
  && forces.activePoses === 124 && forces.missingDriveCount === 0 && forces.lockingPoses === 60
  && forces.missingLockCount === 0 && forces.minimumAcceptedOutputMoment > 0
  && generated.refinement.maximumMatchedAdvanceDifference < 1e-7 && generated.refinement.peakDifference < 1e-5
  && equivalence.exact && equivalence.registryChecked && equivalence.maximumMatrixError === 0
  && equivalence.rows.every(row => row.priorTopologyGeometryEqual);
const focused = await json('069-focused-tests-retry1-exit-status'), numerical = await optional('069-numerical-exit-status');
const build = await optional('069-build-exit-status'), browser = await optional('069-browser-tests-exit-status');
const focusedPassed = pass(focused) && /^# pass 8$/m.test(await readFile(directory + '069-focused-tests-retry1.log', 'utf8'));
const numericalPassed = pass(numerical) && /^# pass 3034$/m.test(await readFile(directory + '069-numerical.log', 'utf8'));
const browserPassed = pass(browser) && /\b29 passed\b/.test(await readFile(directory + '069-browser-tests.log', 'utf8'));
const inspected = inspection?.frames.length === 10 && inspection.frames.every(frame => frame.inspected)
  && inspection.uiFrames.length === 2 && inspection.uiFrames.every(frame => frame.inspected);
const complete = mechanics && focusedPassed && numericalPassed && pass(build) && browserPassed && inspected;
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[68]);
record.status = complete ? 'rebuilt-and-verified' : 'integrated-validation-in-progress';
record.productionChanged = true; record.mechanicsPassed = mechanics;
record.sourceHashes = hashes; record.inspection = inspection; record.candidateInspection = candidate;
record.reconstruction = {
  factory: 'src/simulation/small-single-tooth-index.js', motion: 'src/simulation/small-single-tooth-index-motion.js',
  profile: 'src/data/small-single-tooth-index-profile.js', solids: 6, teeth: 30,
  parameters: model.root.userData.geometry, physicalModel: model.root.userData.idealConstraints,
  limitation: 'Loaded quasistatic contact with a short internal pause held by passive bearing resistance. Finite-inertia impacts and unloaded coasting are not certified.',
};
record.sourceComparison = { report: '069-all-readings-source-fit.json', anchor: source.anchor, scale: source.scale,
  groups: source.groups.map(({ rows, ...group }) => group), adjustments: source.adjustments,
  omitted: source.omitted, qualification: source.method + ' ' + source.pixelReadingQualification,
  overlay: candidate.captures.find(frame => frame.view === 'source-overlay-all-readings') };
record.correctedMechanics = {
  hardware: { report: '069-lock-event-hardware.json', poses: hardware.poses, pairs: hardware.pairs.length,
    checks: hardware.checks, inside: hardware.inside, penetrationTolerance: 1e-6 },
  locking: { report: '069-lock-event-locking.json', cases: locking.poses, issues: locking.issues.length,
    checks: locking.checks, fullAngularPlay: locking.fullAngularPlay, overtravel: locking.overtravel,
    qualification: 'All valid seats clear. Deliberately prohibited overtravel must penetrate to prove each stop.' },
  forces: { report: '069-lock-event-contact-cones.json', poses: forces.poses, activePoses: forces.activePoses,
    missingDriveCount: forces.missingDriveCount, lockingPoses: forces.lockingPoses, missingLockCount: forces.missingLockCount,
    minimumAcceptedOutputMoment: forces.minimumAcceptedOutputMoment, gapTolerance: forces.gapTolerance,
    angleTolerance: forces.angleTolerance, powerTolerance: forces.powerTolerance },
  solids: { report: '069-balanced-solids-retry1.json', count: solids.rows.length, issues: solids.issues.length },
  convergence: generated.refinement, entryEvents: generated.events, finalLockEvent: event,
  equivalence: '069-integrated-candidate-equivalence.json', exits,
};
const trials = ['source-motion', 'short-tip-008', 'short-tip-016', 'short016-deep008', 'short016-deep016',
  'short016-deep012', 'short012-deep016', 'short008-deep020', 'short014-deep014', 'short015-deep012', 'short016-deep010',
  'balanced-fine-2600', 'balanced-fine-5200'];
record.profileTrials = [];
for (const name of trials) {
  const trial = await json('069-' + name);
  record.profileTrials.push({ report: `069-${name}.json`, exit: await json(`069-${name}-exit-status`),
    toothShortening: trial.parameters.toothShortening, rootDeepening: trial.parameters.rootDeepening,
    poses: trial.poses, actualAdvance: trial.actualAdvance, expectedAdvance: trial.expectedAdvance,
    maximumSpeed: trial.maximumSpeed, failed: trial.failed,
    qualification: 'Exit zero means the diagnostic completed; failed or partial indexing is not acceptance.' });
}
record.preservedFailures = [
  { report: '069-balanced-solids.json', exit: '069-balanced-solids-exit-status.json',
    reason: 'Redundant collinear stem vertices produced eighty degenerate triangles and 224 unmatched edges. Outline-preserving pruning resolved the defect.' },
  { report: '069-balanced-contact-cones.json', exit: '069-balanced-contact-cones-exit-status.json',
    reason: 'One interpolated final half-step prescribed output motion after actual rim contact. The explicit Float32 junction event resolves it continuously.' },
  { log: '069-focused-tests.log', exit: '069-focused-tests-exit-status.json',
    reason: 'Three exact zero-speed assertions distinguished IEEE negative zero from positive zero. Tests now compare the magnitude; geometry and motion were unchanged.' },
];
record.regression = {
  focused: { passed: focusedPassed ? 8 : null, exit: focused, log: '069-focused-tests-retry1.log' },
  numerical: { passed: numericalPassed ? 3034 : null, exit: numerical, log: '069-numerical.log' },
  build: { exit: build, log: '069-build.log' },
  browser: { passed: browserPassed ? 29 : null, exit: browser, log: '069-browser-tests.log' },
};
record.animationTiming = model.root.userData.animationTiming;
record.remaining = complete ? [] : ['Complete full numerical/build/browser verification and inspect/hash all integrated views.'];
await writeFile(directory + '069-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const existing = await readFile(directory + 'index.html', 'utf8'), marker = '<div class="grid">';
if (!existing.includes(marker)) throw new Error('Missing gallery marker');
const files = (await readdir(directory)).filter(file => /^\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+\.png$/.test(file)).sort();
await writeFile(directory + 'index.html', existing.slice(0, existing.indexOf(marker) + marker.length) + '\n'
  + files.map(file => `<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, mechanics, focusedPassed, numericalPassed, browserPassed, inspected, comparisons: files.length });
