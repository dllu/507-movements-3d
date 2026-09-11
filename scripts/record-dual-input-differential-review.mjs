import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const directory = 'artifacts/review/';
const catalog = await json('src/data/movements.json');
const model = createMovementModel(catalog.movements[61]);
const configurations = ['open', 'crossed'];
const labels = configurations.flatMap(configuration => ['output', 'side'].flatMap(gear =>
  ['positive', 'negative'].map(direction => `${configuration}-${gear}-${direction}`)));
const flanks = await Promise.all(labels.map(label => json(`${directory}062-candidate-flank-${label}.json`)));
const hardware = await Promise.all(configurations.map(configuration => json(`${directory}062-candidate-hardware-${configuration}.json`)));
const solids = await Promise.all(configurations.map(configuration => json(`${directory}062-candidate-solids-${configuration}.json`)));
const exact = await json(`${directory}062-candidate-exact-contact.json`);
const motion = await json(`${directory}062-candidate-motion-check.json`);
const alignment = await json(`${directory}062-source-alignment.json`);
const probeExits = await json(`${directory}062-candidate-probe-exit-statuses.json`);
const numerical = await json(`${directory}062-numerical-exit-status.json`).catch(() => null);
const browserExit = await json(`${directory}062-browser-exit-status.json`).catch(() => null);
const numericalLog = await readFile(`${directory}062-numerical-exit-check.log`, 'utf8').catch(() => '');
const browserLog = await readFile(`${directory}062-browser-tests.log`, 'utf8').catch(() => '');
const buildLog = await readFile(`${directory}062-build.log`, 'utf8');
const focusedBrowserLog = await readFile(`${directory}062-focused-browser-tests.log`, 'utf8');
const files = (await readdir(directory)).filter(file => /^062-(?:crossed-)?(?:full-)?phase-[\d_]+\.png$/.test(file)).sort();
const browserResult = browserLog.match(/22 passed[^\n]*/)?.[0] ?? null;
const numericalPassed = Number(numericalLog.match(/# pass (\d+)/)?.[1]) || null;
const solidIssues = solids.flatMap((rows, i) => rows.filter(row => row.volume <= 0 || row.zeroFaces
  || row.badNormals || row.unpairedEdges || row.inconsistentEdges).map(row => ({ configuration: configurations[i], ...row })));
const flankSummary = flanks.flatMap(report => report.summary.map(row => ({ configuration: report.configuration, ...row })));
const beltContacts = exact.rows.filter(row => row.kind === 'belt-contact');
const hardwareClearances = exact.rows.filter(row => row.kind === 'hardware-clearance');
const crossover = exact.rows.find(row => row.kind === 'crossover-clearance');
const complete = numerical?.code === 0 && numericalPassed === 2984 && browserExit?.code === 0 && browserResult
  && /built in/.test(buildLog) && /1 passed/.test(focusedBrowserLog) && files.length === 12
  && solids.every(rows => rows.length === 19) && !solidIssues.length
  && hardware.every(report => report.poses === 97 && report.pairs.length === 152 && report.inside === 0)
  && probeExits.length === 10 && probeExits.every(row => row.code === 0)
  && flankSummary.length === 8 && flankSummary.every(row => row.rows === 129 && row.intersections === 0
    && row.minimumGap > 0.00002 && row.maximumGap < 0.00008 && row.maximumPowerResidual < 0.00181)
  && exact.rows.length === 145 && beltContacts.length === 48 && beltContacts.every(row => row.witness
    && row.distance > 0.00012 && row.distance < 0.00020)
  && hardwareClearances.length === 96 && hardwareClearances.every(row => row.distance > 1e-6)
  && crossover?.distance > 0.046 && crossover.witness
  && motion.maximumRelativeNeutralSlip < 1e-9 && motion.stoppedShifts === 8
  && alignment.rows.every(row => Math.abs(row.topResidual) < 14 && Math.abs(row.bottomResidual) < 14);
const record = {
  movement: 62, status: complete ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_062.html', reference: '../reference/brown-062-detail.png',
  notes: '062-reconstruction-notes.md',
  interpretation: 'A permanent flat selector band connects a broad upper drum to loose, direct-output or differential-carrier lower pulleys. A second permanent flat band drives a fourth lower pulley and its side bevel. Equal opposed bevels enforce output plus side input equals twice carrier. Installing the auxiliary band open subtracts its positive input in carrier mode; crossing it reverses that input and adds its magnitude.',
  sourceChoices: 'Measured source envelopes determine the concentric drum sizes, four lower pulleys and compact enclosed differential. Equal 34-tooth side bevels and a 20-tooth radial planet use complementary pitch cones. Counts and concealed bearings are inferred; the engraving does not specify them.',
  sourceLimits: 'No official animation is available. The drawn shaft and pulley centers disagree by about 20–24 scan pixels. The concentric model fits all 12 measured body/shaft outlines within 13.5 scan pixels; this excludes interrupted band arches and hidden internals. Overlays show convex projected envelopes of actual mesh vertices, not exact internal holes or individual tooth spaces.',
  neutralAndShifts: 'The demonstrator stops the input in neutral and during every selector shift. An auxiliary-driven differential with both output and carrier free has an unconstrained speed, so neutral is not presented as a uniquely determined free-running motion. Open/crossed are separately installed configurations; selecting one restarts time while preserving play/pause and section state.',
  geometry: model.root.userData.geometry, timing: model.root.userData.animationTiming,
  configurations: model.root.userData.configurations,
  camera: { source: model.cameraDirection.toArray(), full: model.root.userData.fullCameraDirection.toArray(), groundHidden: true, sectionToggle: true },
  evidence: {
    sourceMeasurements: '062-source-envelope-measurement.json', interactiveSourceOverlay: '062-source-alignment.html',
    sourceResiduals: alignment.rows.map(({ name, topResidual, bottomResidual }) => ({ name, topResidual, bottomResidual })),
    bevelFlanks: { summary: flankSummary, reports: labels.map(label => `062-candidate-flank-${label}.json`),
      totalPoses: flankSummary.reduce((sum, row) => sum + row.rows, 0),
      maximumNormalForcePowerResidual: Math.max(...flankSummary.map(row => row.maximumPowerResidual)) },
    independentTriangleContact: { report: '062-candidate-exact-contact.json', rows: exact.rows.length,
      beltContactRows: beltContacts.length, hardwareRows: hardwareClearances.length,
      minimumWorkingGap: Math.min(...beltContacts.map(row => row.distance)),
      maximumWorkingGap: Math.max(...beltContacts.map(row => row.distance)), crossover },
    hardware: { configurations: hardware.map(report => ({ configuration: report.configuration, poses: report.poses,
      pairs: report.pairs.length, checks: report.checks, inside: report.inside, report: `062-candidate-hardware-${report.configuration}.json` })),
      combinedChecks: hardware.reduce((sum, report) => sum + report.checks, 0),
      combinedInside: hardware.reduce((sum, report) => sum + report.inside, 0) },
    solids: { geometriesPerConfiguration: solids.map(rows => rows.length), issues: solidIssues,
      reports: configurations.map(configuration => `062-candidate-solids-${configuration}.json`) },
    motion: { ...motion, report: '062-candidate-motion-check.json' },
    probeExits: { report: '062-candidate-probe-exit-statuses.json', rows: probeExits },
    focusedTests: { passedInFullNumericalSuite: 7, log: '062-numerical-exit-check.log',
      initialFailure: '062-focused-initial-tests.log', correctedConfigurationTest: '062-configuration-test.log',
      explanation: 'The first focused run passed six tests; its engine test stub omitted the real matrix-world refresh. The stub was corrected. The targeted test and all seven focused tests in the full numerical suite then passed.' },
    numericalTests: { passed: numericalPassed, exit: numerical, log: '062-numerical-exit-check.log' },
    focusedBrowser: { result: focusedBrowserLog.match(/1 passed[^\n]*/)?.[0] ?? null, log: '062-focused-browser-tests.log',
      initialFailure: '062-focused-initial-browser-tests.log', explanation: 'The initial exact getByLabel locator did not match the implicit label including option text. The test now locates the existing accessible combobox by role and name.' },
    browserTests: { result: browserResult, exit: browserExit, log: '062-browser-tests.log' },
    build: { passed: /built in/.test(buildLog), result: buildLog.match(/built in[^\n]*/)?.[0], log: '062-build.log' },
    sourceComparisons: files,
    inspectedViews: 'All twelve integrated open/crossed source and complete-oblique frames, both source overlays, desktop and mobile controls; candidate source, rear, high-speed and crossed-oblique views.',
  },
  baseline: { factory: '062-original-factory.txt', legacyBaseFactory: '061-original-factory.txt', tests: '062-original-test.txt',
    parameters: '062-baseline-parameters.json', hardware: '062-hardware-baseline.json', exactHardware: '062-exact-hardware-baseline.json',
    bevels: '062-bevel-contact-baseline.json', belts: '062-belt-contact-baseline.json',
    failures: 'The exposed gear train is oversized. Carrier/input sleeves and the transverse axle/arm intersect independent parts. Both round bands intersect upper pulleys and float above lower body treads. The auxiliary driver is too large in ratio but too narrow axially, and the source camera order is reversed.',
    qualifications: 'The old sampled teeth and selected lifted central crossed-band spans do clear; these are not claimed as defects. Both obsolete factory bodies were removed only after exact comparison with their archived originals.' },
  rendering: 'Closed physical geometry remains present in both views. Local clipping and fixed nonphysical caps expose only the two hollow lower pulley cases. Configuration changes replace the auxiliary band geometry on the same permanently visible mesh. Ground is hidden. The crossed free spans have prescribed opposite axial bows.',
  evidenceLimits: 'Finite tessellated surface sweeps do not certify arbitrary unsampled clearance. The bevel teeth use back-cone involute approximations with conical heel/toe ends, not a manufactured octoid solution. Maximum sampled contact-normal power residual is below 0.181 percent in the carrier frame. Bearings, retention, stopping and routing are ideal constraints; transient friction, belt elasticity, twist equilibrium and inertia are not solved.',
};
await writeFile(`${directory}062-reconstruction.json`, JSON.stringify(record, null, 2) + '\n');
const galleryPath = `${directory}index.html`, existing = await readFile(galleryPath, 'utf8');
const galleryFiles = (await readdir(directory)).filter(file => /^\d{3}-(?:crossed-)?(?:full-)?phase-[\d_]+\.png$/.test(file)).sort();
const marker = '<div class="grid">';
if (!existing.includes(marker)) throw new Error('Review gallery grid marker is missing.');
const prefix = existing.slice(0, existing.indexOf(marker) + marker.length);
await writeFile(galleryPath, prefix + '\n' + galleryFiles.map(file =>
  `<a href="${file}"><img src="${file}" loading="lazy" alt="${file}"><span>${file}</span></a>`).join('\n') + '\n</div></html>\n');
console.log({ status: record.status, numerical: numericalPassed, browserResult, comparisons: galleryFiles.length });
