import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const dir = 'artifacts/review/', json = async name => JSON.parse(await readFile(dir + name, 'utf8'));
const optional = async name => { try { return await json(name); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const hashes = await json('066-verification-source-hashes.json');
for (const [file, expected] of Object.entries(hashes)) if (await digest(file) !== expected) throw new Error('Verification source changed: ' + file);
const record = await json('066-reconstruction.json'), inspection = await json('066-capture-inspection.json');
for (const frame of [...record.baselineCaptures, ...inspection.frames, inspection.sourceOverlay, ...inspection.uiFrames])
  if (await digest(dir + frame.file) !== frame.sha256) throw new Error('Inspected frame changed: ' + frame.file);
const dynamics = await json('066-event-resolved-dynamics.json'), hardware = await json('066-complete-hardware.json');
const solids = await json('066-complete-solids.json'), pin = await json('066-final-pin-contact.json');
const worm = await json('066-refined-worm.json'), translation = await json('066-refined-worm-translation-envelope.json');
const convergence = await json('066-refined-worm-convergence.json'), source = await json('066-complete-source-outline.json');
const equivalence = await json('066-integrated-candidate-equivalence.json'), originalWorm = await json('066-candidate-worm.json');
const exitNames = ['066-event-resolved-dynamics', '066-complete-hardware', '066-complete-solids',
  '066-final-pin-contact', '066-refined-worm', '066-refined-worm-translation-envelope', '066-refined-worm-convergence'];
const exits = Object.fromEntries(await Promise.all(exitNames.map(async name => [name, await json(name + '-exit-status.json')])));
const pass = exit => exit?.code === 0 && exit.signal === null;
const mechanics = Object.values(exits).every(pass) && hardware.poses === 140 && hardware.pairs.length === 39 && hardware.inside === 0
  && solids.rows.length === 11 && solids.issues.length === 0 && pin.passed && pin.summary.poses === 82
  && dynamics.status === 'isolated-dynamics-verified' && dynamics.summary.maximumEnergyResidual < 1e-7
  && worm.summary.poses === 65 && worm.summary.inside === 0 && worm.summary.minimumGap > 1e-6
  && worm.summary.maximumPowerResidual < 0.02 && worm.summary.minimumOutputTorque > 0
  && translation.passed && convergence.passed && equivalence.exact;
const numerical = await optional('066-numerical-exit-status.json'), build = await optional('066-build-exit-status.json');
const browser = await optional('066-browser-tests-exit-status.json'), focused = await json('066-focused-tests-exit-status.json');
const numericalPassed = pass(numerical) && /^# pass 3009$/m.test(await readFile(dir + '066-numerical.log', 'utf8'));
const browserPassed = pass(browser) && /\b26 passed\b/.test(await readFile(dir + '066-browser-tests.log', 'utf8'));
const focusedPassed = pass(focused) && /^# pass 9$/m.test(await readFile(dir + '066-focused-tests.log', 'utf8'));
const inspected = inspection.frames.length === 10 && inspection.frames.every(f => f.inspected) && inspection.sourceOverlay.inspected
  && inspection.desktopAndMobileInspected && inspection.uiFrames.length === 2 && inspection.uiFrames.every(f => f.inspected);
const complete = mechanics && inspected && focusedPassed && numericalPassed && pass(build) && browserPassed;
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[65]);
record.status = complete ? 'rebuilt-and-verified' : 'integrated-validation-in-progress'; record.productionChanged = true;
record.sourceHashes = hashes; record.mechanicsPassed = mechanics; record.inspection = inspection;
record.reconstruction = { factory: 'src/simulation/gravity-jump-weight.js', motion: 'src/simulation/gravity-jump-motion.js',
  profile: 'src/data/gravity-jump-worm-profile.js', solids: 11, wheelTeeth: 26,
  physicalModel: 'Uniform bob, arm, sleeve and eccentric half-collar mass properties; gravity and explicit viscous resistance; finite two-sided pin allowance; exact unilateral releases and inelastic impacts; grounded bearings and constant-speed input idealized.' };
record.sourceComparison = { report: '066-complete-source-outline.json', boundaryReadings: source.groups.reduce((s, g) => s + g.rows.length, 0),
  groups: source.groups.map(({ rows, ...g }) => g), centers: source.centers,
  qualification: 'One common source scale/center, manually marked visible boundaries, and regularized tooth count. The drawing abbreviates upper teeth and uses imperfect worm proportions/perspective. These sampled residuals do not establish exact whole-image overlap.' };
record.correctedMechanics = {
  dynamics: { report: '066-event-resolved-dynamics.json', parameters: dynamics.parameters, summary: dynamics.summary, events: dynamics.events },
  pinContact: { report: '066-final-pin-contact.json', summary: pin.summary },
  worm: { report: '066-refined-worm.json', summary: worm.summary },
  hardware: { report: '066-complete-hardware.json', poses: hardware.poses, pairs: hardware.pairs.length, checks: hardware.checks, inside: hardware.inside },
  solids: { report: '066-complete-solids.json', count: solids.rows.length, issues: solids.issues.length },
  translation: { report: '066-refined-worm-translation-envelope.json', passed: translation.passed, rows: translation.rows },
  convergence: { report: '066-refined-worm-convergence.json', summary: convergence.summary },
  completeChecks: hardware.checks + worm.summary.checks, equivalence: '066-integrated-candidate-equivalence.json', exits,
};
record.rejectedInitialWorm = { report: '066-candidate-worm.json', exit: await json('066-candidate-worm-exit-status.json'),
  sampledChecks: originalWorm.summary.checks, sampledPenetrations: originalWorm.summary.inside,
  exactIntersectionPoses: originalWorm.rows.filter(r => r.gap === 0).length,
  excessivePowerResidualPoses: originalWorm.rows.filter(r => r.residual > 0.02).length };
record.regression = { focused: { passed: focusedPassed ? 9 : null, exit: focused, log: '066-focused-tests.log' },
  numerical: { passed: numericalPassed ? 3009 : null, exit: numerical, log: '066-numerical.log' },
  build: { exit: build, log: '066-build.log' }, browser: { passed: browserPassed ? 26 : null, exit: browser, log: '066-browser-tests.log' } };
record.animationTiming = model.root.userData.animationTiming;
record.remaining = complete ? [] : ['Complete pending full browser verification and inspect/hash desktop/mobile frames before final acceptance.'];
await writeFile(dir + '066-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const existing = await readFile(dir + 'index.html', 'utf8'), marker = '<div class="grid">';
const prefix = existing.slice(0, existing.indexOf(marker) + marker.length);
const files = (await readdir(dir)).filter(f => /^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
await writeFile(dir + 'index.html', prefix + '\n' + files.map(f => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, mechanics, inspected, numericalPassed, browserPassed, comparisons: files.length });
