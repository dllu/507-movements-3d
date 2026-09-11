import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const directory = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(directory + name + '.json', 'utf8'));
const optional = async name => { try { return await json(name); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const pass = exit => exit?.code === 0 && exit.signal === null;
const hashes = await json('068-verification-source-hashes');
for (const [file, expected] of Object.entries(hashes)) {
  if (await digest(file) !== expected) throw new Error('Verification source changed: ' + file);
}
const record = await json('068-reconstruction'), inspection = await json('068-capture-inspection');
for (const frame of [...record.baselineCaptures, ...inspection.frames, inspection.sourceOverlay, ...inspection.uiFrames]) {
  if (await digest(directory + frame.file) !== frame.sha256) throw new Error('Inspected frame changed: ' + frame.file);
}
const hardware = await json('068-event-hardware'), locking = await json('068-event-locking');
const forces = await json('068-event-drive-and-lock-cones'), solids = await json('068-trimmed-solids');
const convergence = await json('068-corner-refinement'), source = await json('068-trimmed-source-source-fit');
const equivalence = await json('068-integrated-candidate-equivalence');
const exitNames = ['event-hardware', 'event-locking', 'event-drive-and-lock-cones', 'trimmed-solids',
  'entry-event', 'event-profile-generation', 'integrated-source-capture', 'integrated-full-capture', 'display-profile'];
const exits = Object.fromEntries(await Promise.all(exitNames.map(async name => [name, await json(`068-${name}-exit-status`)])));
const mechanics = Object.values(exits).every(pass) && hardware.poses === 83 && hardware.pairs.length === 9
  && hardware.checks === 42701508 && hardware.inside === 0 && solids.rows.length === 6 && solids.issues.length === 0
  && locking.rows.length === 20 && locking.issues.length === 0
  && locking.rows.every(row => row.allowed.inside === 0 && row.blocked.inside > 0)
  && forces.activePoses === 136 && forces.missingDriveCount === 0 && forces.lockingPoses === 20
  && forces.missingLockCount === 0 && forces.minimumAcceptedOutputMoment > 0
  && convergence.maximumMatchedAngleDifference < 1e-7 && convergence.peakDifference < 1e-6
  && equivalence.exact && equivalence.maximumMatrixError === 0
  && equivalence.rows.every(row => row.priorTopologyGeometryEqual);
const focused = await json('068-focused-tests-exit-status'), numerical = await optional('068-numerical-exit-status');
const build = await optional('068-build-exit-status'), browser = await optional('068-browser-tests-exit-status');
const focusedPassed = pass(focused) && /^# pass 7$/m.test(await readFile(directory + '068-focused-tests.log', 'utf8'));
const numericalPassed = pass(numerical) && /^# pass 3026$/m.test(await readFile(directory + '068-numerical.log', 'utf8'));
const browserPassed = pass(browser) && /\b28 passed\b/.test(await readFile(directory + '068-browser-tests.log', 'utf8'));
const inspected = inspection.frames.length === 10 && inspection.frames.every(frame => frame.inspected)
  && inspection.sourceOverlay.inspected && inspection.desktopAndMobileInspected
  && inspection.uiFrames.length === 2 && inspection.uiFrames.every(frame => frame.inspected);
const complete = mechanics && focusedPassed && numericalPassed && pass(build) && browserPassed && inspected;
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[67]);
record.status = complete ? 'rebuilt-and-verified' : 'integrated-validation-in-progress';
record.productionChanged = true; record.mechanicsPassed = mechanics;
record.sourceHashes = hashes; record.inspection = inspection;
record.reconstruction = {
  factory: 'src/simulation/single-tooth-index.js', motion: 'src/simulation/single-tooth-index-motion.js',
  profile: 'src/data/single-tooth-index-profile.js', solids: 6, notches: 10,
  parameters: model.root.userData.geometry,
  physicalModel: model.root.userData.idealConstraints,
  limitation: 'Quasistatic loaded motion; finite-inertia impacts and unloaded coasting are not certified.',
};
record.sourceComparison = {
  report: '068-trimmed-source-source-fit.json', anchor: source.anchor, scale: source.scale,
  groups: source.groups.map(({ rows, ...group }) => ({ ...group, readings: rows.length })),
  qualification: 'One common source scale and anchor, with manually read visible boundaries. Regular notches approximate irregular engraved endpoints; sampled residuals do not establish exact whole-image registration.',
};
record.correctedMechanics = {
  hardware: { report: '068-event-hardware.json', poses: hardware.poses, pairs: hardware.pairs.length,
    checks: hardware.checks, inside: hardware.inside, penetrationTolerance: 1e-6 },
  locking: { report: '068-event-locking.json', cases: locking.rows.length, issues: locking.issues.length,
    checks: locking.rows.reduce((sum, row) => sum + row.allowed.checks + row.blocked.checks, 0),
    seatOffset: locking.seatOffset, fullAngularPlay: locking.fullAngularPlay, overtravel: locking.overtravel,
    qualification: 'Allowed seats clear; deliberately prohibited overtravel must penetrate to prove the stop.' },
  forces: { report: '068-event-drive-and-lock-cones.json', poses: forces.poses, activePoses: forces.activePoses,
    missingDriveCount: forces.missingDriveCount, lockingPoses: forces.lockingPoses, missingLockCount: forces.missingLockCount,
    minimumAcceptedOutputMoment: forces.minimumAcceptedOutputMoment, gapTolerance: forces.gapTolerance,
    angleTolerance: forces.angleTolerance, powerTolerance: forces.powerTolerance },
  solids: { report: '068-trimmed-solids.json', count: solids.rows.length, issues: solids.issues.length },
  convergence: { report: '068-corner-refinement.json', ...convergence },
  entry: { report: '068-corner-events-6400.json', time: model.root.userData.geometry.entryTime },
  equivalence: '068-integrated-candidate-equivalence.json', exits,
};
record.regression = {
  focused: { passed: focusedPassed ? 7 : null, exit: focused, log: '068-focused-tests.log' },
  numerical: { passed: numericalPassed ? 3026 : null, exit: numerical, log: '068-numerical.log' },
  build: { exit: build, log: '068-build.log' },
  browser: { passed: browserPassed ? 28 : null, exit: browser, log: '068-browser-tests.log' },
};
record.animationTiming = model.root.userData.animationTiming;
record.remaining = complete ? [] : ['Complete full regression verification and inspect/hash desktop/mobile views.'];
await writeFile(directory + '068-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const existing = await readFile(directory + 'index.html', 'utf8'), marker = '<div class="grid">';
if (!existing.includes(marker)) throw new Error('Missing gallery marker');
const files = (await readdir(directory)).filter(file => /^\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+\.png$/.test(file)).sort();
await writeFile(directory + 'index.html', existing.slice(0, existing.indexOf(marker) + marker.length) + '\n'
  + files.map(file => `<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, mechanics, focusedPassed, numericalPassed, browserPassed, inspected, comparisons: files.length });
