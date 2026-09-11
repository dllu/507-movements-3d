import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const catalog = await read('src/data/movements.json'), model = createMovementModel(catalog.movements[52]);
const hardware = (await readFile('artifacts/review/053-hardware-tests.log', 'utf8')).split('\n').find((s) => s.includes('"hardwareRays"'));
const files = (await readdir('artifacts/review')).filter((f) => /^053-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const p = model.root.userData.geometry, timing = model.root.userData.animationTiming;
const numerical = await readFile('artifacts/review/053-full-tests.log', 'utf8');
const focused = await readFile('artifacts/review/053-final-focused-tests.log', 'utf8');
const browser = await readFile('artifacts/review/053-browser-tests.log', 'utf8');
const browserPassed = /13 passed/.test(browser);
const exitStatus = await read('artifacts/review/053-numerical-exit-status.json').catch(() => null);
const latestNumerical = exitStatus ? await readFile('artifacts/review/053-numerical-exit-check.log', 'utf8') : numerical;
const record = { movement: 53, status: browserPassed && exitStatus?.code === 0 ? 'rebuilt-and-verified' : 'rebuilt-verification-pending',
  source: 'https://507movements.com/mm_053.html', reference: '../reference/brown-053-detail.png',
  interpretation: 'The vertical shaft turns two equal loose bevel gears oppositely. A feathered double clutch selects either one. Its waisted body, triangular crown teeth, short shaft ends and bent selector follow the source engraving.',
  inference: 'The engraving does not dimension the tooth counts, flanks, fits, selector joints, load or timing. Twelve symmetric triangular crown teeth, helicoidal working faces, a pivoted selector shoe and retained pins are reconstruction choices. External bearing supports and the external selector actuator are outside the drawing.',
  geometry: p,
  crownProfiles: Object.fromEntries(['leftCrown', 'rightCrown', 'leftSlidingCrown', 'rightSlidingCrown']
    .map((name) => [name, model.root.userData.parts[name].geometry.userData.profile])),
  camera: { source: model.cameraDirection.toArray(), complete: model.root.userData.fullCameraDirection.toArray(),
    fieldOfView: 17, groundHidden: true, shadowCameraHalfExtent: 2, shadowBias: -0.00003 },
  motion: { cycleMeaning: 'One forward selection and one reverse selection, with the output stopping between them; the input makes one revolution per operation.',
    derivation: 'For crown pitch P and tooth height H, the axial height envelope is H + (2H/P)|delta - P/2|. The selected angular clearance follows the changing base-face gap. During insertion and withdrawal the output speed magnitude is inputSpeed + shiftSpeed/(2H/P).',
    force: 'Output torque equals inertia times acceleration. The selected tooth force remains compressive, including withdrawal deceleration. The selector holds an axial force of transmittedTorque/(2H/P). Input power plus selector power equals output power.',
    limits: 'Rigid impact at initial engagement; chosen inertia and constant opposing load. The tooth surface is tessellated with a small numerical clearance. Bearings and feather are ideal fits. Elastic stress, impact deformation, bearing friction and manufactured bevel conjugacy are not simulated.' },
  display: { ...timing, maximumInputRevolutionsPerSecond: 0.5,
    maximumOutputRevolutionsPerSecond: (p.inputAngularSpeed + 1.5 * (p.stroke - p.touchShift - p.entryOverlap)
      / (p.insertedTime - p.lockTime) / p.flankSlope) * timing.playbackTimeScale / (2 * Math.PI) },
  evidence: { denseContact: await read('artifacts/review/053-contact.json'), crownContact: await read('artifacts/review/053-crown-contact.json'),
    bevelContact: await read('artifacts/review/053-bevel-contact.json'), hardware: JSON.parse(hardware.slice(2)),
    focusedTests: { passed: Number(focused.match(/# pass (\d+)/)[1]), includes: 'Six 053 tests and eight shared 048 jaw-clutch regression tests',
      durationSeconds: Number(focused.match(/# duration_ms ([\d.]+)/)[1]) / 1000, log: '053-final-focused-tests.log' },
    fullNumericalTests: { passed: Number(latestNumerical.match(/# pass (\d+)/)[1]), failed: Number(latestNumerical.match(/# fail (\d+)/)[1]),
      durationSeconds: Number(latestNumerical.match(/# duration_ms ([\d.]+)/)[1]) / 1000,
      log: exitStatus ? '053-numerical-exit-check.log' : '053-full-tests.log', exitStatus,
      initialCommand: { log: '053-full-tests.log', reportedExitCode: 143,
        note: 'The initial npm command produced complete passing TAP, but its outer process reported exit 143. A direct numerical rerun records the child exit code and signal explicitly.' } },
    build: { passed: /built in/.test(numerical), durationSeconds: Number(numerical.match(/built in ([\d.]+)s/)[1]), log: '053-full-tests.log' },
    browser: { status: browserPassed ? 'passed' : 'running', result: browserPassed ? browser.match(/13 passed[^\n]*/)[0] : null,
      log: '053-browser-tests.log' }, sourceComparisons: files },
  baseline: { factory: '053-original-factory.txt', clutchContact: '053-clutch-contact-baseline.json', bevelContact: '053-bevel-contact-baseline.json',
    observations: 'The old four-dog clutch declared torque transmission while its nearest opposed surfaces remained about 0.0314 apart. The bevel faces and shafts were oversized, and the clutch was too short.' },
  evidenceLimits: 'Surface samples and finite contact poses provide independent numerical evidence; they are not a continuous collision proof or certification of all 507 mechanisms.' };
await writeFile('artifacts/review/053-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
console.log({ status: record.status, display: record.display });
