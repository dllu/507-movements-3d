import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';

const directory = 'artifacts/review/';
const json = async name => JSON.parse(await readFile(directory + name, 'utf8'));
const optional = async name => json(name).catch(() => null);
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[30]);
const worm = await json('031-source-29-worm-power-full.json');
const hardware = await json('031-source-29-worm-hardware.json');
const convergence = await json('031-source-29-hob-convergence.json');
const equivalence = await json('031-integrated-candidate-equivalence.json');
const alignment = await json('031-source-29-source-outline.json');
const preservation = await json('031-contact-table-preservation.json');
const exits = await json('031-source-29-probe-exit-statuses.json');
const inspection = await json('031-capture-inspection.json');
const numerical = await optional('031-numerical-exit-status.json');
const browser = await optional('031-browser-exit-status.json');
const browserRerun = await optional('031-browser-057-rerun-exit-status.json');
const build = await optional('031-build-exit-status.json');
const numericalLog = await readFile(directory + '031-numerical.log', 'utf8').catch(() => '');
const browserLog = await readFile(directory + '031-browser-tests.log', 'utf8').catch(() => '');
const numericalPassed = Number(numericalLog.match(/# pass (\d+)/)?.[1]) || null;
const browserPassed = Number(browserLog.match(/(\d+) passed[^\n]*/)?.[1]) || null;
const rerunLog = await readFile(directory + '031-browser-057-rerun.log', 'utf8').catch(() => '');
const failures = [...browserLog.matchAll(/^\s+✘\s+\d+\s+([^\n]+)/gm)].map(match => match[1]);
const recoveredTimeout = browser?.code === 1 && !browser.signal && browserPassed === 23
  && failures.length === 1 && failures[0].startsWith('tests/e2e/band-epicyclic.spec.mjs:')
  && browserLog.includes('Test timeout of 45000ms exceeded.')
  && browserRerun?.code === 0 && !browserRerun.signal && /\b1 passed\b/.test(rerunLog);
const browserVerified = (browser?.code === 0 && !browser.signal && browserPassed === 24) || recoveredTimeout;
const mechanics = worm.summary.poses === 65 && worm.summary.inside === 0
  && worm.summary.minimumGap > 1e-6 && worm.summary.maximumGap < 0.00004
  && worm.summary.minimumOutputTorque > 0 && worm.summary.maximumPowerResidual < 0.02
  && hardware.summary.poses === 65 && hardware.summary.pairs === 8 && hardware.summary.inside === 0
  && hardware.topology.length === 6 && hardware.summary.topologyIssues === 0
  && convergence.maximumDifference < 1e-10 && equivalence.rows.length === 4 && equivalence.rows.every(row => row.identical)
  && preservation.otherExportsByteIdentical && exits.length === 6 && exits.every(row => row.exitCode === 0);
const complete = mechanics && build?.code === 0 && !build.signal && numerical?.code === 0 && !numerical.signal
  && numericalPassed === 2994 && browserVerified
  && inspection.integratedFrames.length === 6 && inspection.sourceOverlayInspected && inspection.desktopAndMobileInspected;
const hashes = {};
for (const path of ['src/simulation/authored-gears.js', 'src/simulation/worm-gear-geometry.js',
  'src/simulation/worm-wheel-profile.js', 'src/data/contact-profiles.js', 'tests/worm-drive-contact.test.mjs']) {
  hashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
const record = { movement: 31, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_031.html', reference: '../reference/brown-031-detail.png',
  notes: '031-reconstruction-notes.md',
  interpretation: 'A single-start axial-trapezoid cylindrical worm drives a throated generated wheel. One worm revolution advances one wheel tooth. The source-sized wheel has 29 regularized teeth; its starting phase follows the visible tooth spacing. The shaft has unequal overhangs and source-fitted thickness.',
  sourceLimits: 'The 71 marked/scanned outline readings cover visible wheel, worm, shaft and hub boundaries under one orthographic scale/center registration. The irregular tooth spacing favors 29 over the earlier 30; it does not establish an exact historical manufacturing count. Pressure angle, hidden depth, bearings and colors are reconstruction choices.',
  mechanicalLimits: 'Rotation is prescribed. The tests check actual finite surfaces, working normal-force moments and the kinematic ratio, rather than a loaded deflection/friction simulation. Fixed shaft/hub/thread joins form two rigid families with integral or fixed overlaps; independent families must clear. The wheel plane is a painted index. Collision evidence is sampled, not a continuous universal proof.',
  geometry: model.root.userData.geometry, timing: { ...model.root.userData.animationTiming,
    inputTurnsPerFullWheelTurn: 29, completeWheelDuration: model.root.userData.animationTiming.displayCycleDuration * 29 },
  rendering: { groundHidden: model.root.userData.hideGround, sourceCamera: model.cameraDirection.toArray(),
    fullCamera: model.root.userData.fullCameraDirection.toArray() },
  baseline: { report: '031-reopened-worm-power.json', poses: 17, checks: 12592563,
    inside: 0, maximumNormalPowerResidual: 0.0581311566,
    archives: ['031-original-factory.txt', '031-original-worm-profile.json', '031-original-worm-helper.txt',
      '031-original-worm-contact-tests.txt', '031-original-model-test.txt'],
    qualification: 'Legacy clearance tests passed while the new actual loaded-flank force test failed.' },
  corrections: [
    'Replaced the spherical cutter-ray bound with the proper cylindrical interval and finite-length clipping.',
    'Removed neighboring-cell minimum erosion; continuously refined generating phases preserve working flank directions.',
    'Used a 256-by-32 tooth grid and 640 angular screw segments, with a dimension-keyed stored profile.',
    'Changed the regularized tooth count from 30 to 29 after inspecting the unchanged Brown scan; synchronized the screw phase and fitted the shaft overhang/thickness.',
    'Replaced phase-zero-only legacy contact assertions with source-phase synchronization and actual loaded-flank tests.',
    'The runtime fallback and offline studies now use the same corrected generator. Other stored contact tables remain byte-identical.'
  ],
  evidence: { mechanics, worm: { report: '031-source-29-worm-power-full.json', ...worm.summary },
    hardware: { report: '031-source-29-worm-hardware.json', ...hardware.summary, topology: hardware.topology },
    combinedSurfaceChecks: worm.summary.checks + hardware.summary.checks,
    convergence, equivalence, preservation, exits,
    sourceAlignment: { report: '031-source-29-source-outline.json', overlay: '031-source-29-source-overlay.html',
      groups: alignment.groups.map(({ rows, ...group }) => group), harmonicStudy: '031-source-tooth-harmonics.json' },
    inspection, focused: { wormTests: 4, kinematicTest: 1, log: '031-integrated-worm-tests.log' },
    build, numerical: { passed: numericalPassed, exit: numerical, log: '031-numerical.log' },
    browser: { initialPassed: browserPassed, passingTestsAcrossRuns: browserVerified ? 24 : browserPassed,
      exit: browser, log: '031-browser-tests.log', recoveredTimeout,
      rerun: { test: '057 band epicyclic controls', exit: browserRerun, log: '031-browser-057-rerun.log' },
      qualification: recoveredTimeout ? 'The full run passed 23/24, including all 507 canvases and 031 controls. The first 057 test hit its 45-second overall timeout during mouse movement; all completed assertions passed. The unchanged test and application passed on isolated rerun in 29.8 seconds. The initial failure, exit and trace are retained; this is combined passing coverage, not a claim that the original full command exited zero. Software-rendering contention during concurrent numerical tests is a plausible cause, not a proven diagnosis.' : null } },
  regeneration: 'node scripts/bake-worm-drive-profile.mjs', hashes,
  remaining: complete ? [] : ['Finish full regression and desktop/mobile inspection for the integrated state.'] };
await writeFile(directory + '031-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
const gallery = directory + 'index.html', html = await readFile(gallery, 'utf8'), marker = '<div class="grid">';
if (!html.includes(marker)) throw new Error('Missing gallery marker');
const files = (await readdir(directory)).filter(name => /^\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+\.png$/.test(name)).sort();
await writeFile(gallery, html.slice(0, html.indexOf(marker) + marker.length) + '\n'
  + files.map(file => `<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, mechanics, numericalPassed, browserPassed, comparisons: files.length });
