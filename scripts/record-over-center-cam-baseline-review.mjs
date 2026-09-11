import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'artifacts/review/', json = async name => JSON.parse(await readFile(directory + name, 'utf8'));
const source = await readFile('src/simulation/authored-intermittent.js', 'utf8');
const tests = await readFile('tests/models.test.mjs', 'utf8');
const archiveChecks = [];
for (const name of ['factory', 'makeOverCenterCam', 'makeRollerFollower', 'test']) {
  const file = `064-original-${name}.txt`, contents = await readFile(directory + file, 'utf8');
  if (!(name === 'test' ? tests : source).includes(contents.trim())) throw new Error(`Original archive differs from production: ${file}`);
  archiveChecks.push({ file, matchesProduction: true, sha256: createHash('sha256').update(contents).digest('hex') });
}
const baseline = await json('064-contact-baseline.json'), cam = await json('064-source-cam-study.json');
const solids = await json('064-source-cam-solids.json'), dynamics = await json('064-inertial-snap-study-c.json');
const baselineExit = await json('064-contact-baseline-exit-status.json'), solidExit = await json('064-source-cam-solids-exit-status.json');
if (baselineExit.code || baselineExit.signal || solidExit.code || solidExit.signal) throw new Error('A diagnostic did not complete successfully');
if (solids.summary.testedMaximumLead < dynamics.summary.maximumCamLead) throw new Error('Pin travel is not covered by the solid study');
const record = {
  movement: 64, status: 'source-and-baseline-reviewed-isolated-cam-study-production-replacement-pending',
  source: 'https://507movements.com/mm_064.html', reference: '../reference/brown-064-detail.png',
  notes: '064-reconstruction-notes.md', archiveChecks, parameters: '064-baseline-parameters.json',
  sourceInterpretation: 'A bottom worm turns wheel B and its solid shaft. A radial pin drives an independently rotating cam sleeve through the edge of its half-cut end. Spring pressure through a pivoted roller follower resists the rising cam, then assists it after over-center. The cam advances independently and rests until the shaft pin catches it. Half-cut angular freedom is a relative-travel limit, not a prescribed exact half-turn jump.',
  baseline: { report: '064-contact-baseline.json', poses: baseline.poses, summary: baseline.summary,
    checks: baseline.summary.reduce((sum, row) => sum + row.checks, 0),
    inside: baseline.summary.reduce((sum, row) => sum + row.inside, 0), exit: baselineExit,
    captures: ['0', '0_12', '0_2', '0_65'].map(phase => `064-baseline-phase-${phase}.png`),
    capturesInspected: true, interpretation: 'The completed diagnostic confirms defects; zero exit is not a passing mechanical result.',
    correction: 'The first probe incorrectly used the open worm tube as a containment target. Those results are archived with open-tube-target-diagnostic in the filename. The current probe uses tube points into the closed wheel only, plus independent exact triangle distances.' },
  isolatedCamStudy: { contactReport: '064-source-cam-study.json', poses: cam.rows.length,
    trace: '064-source-tracing.html', inspectedTrace: '064-source-tracing.png',
    outline: await json('064-source-cam-outline.json'),
    crest: cam.crest, firstStableMinimum: cam.trough, firstStaticDropDegrees: cam.snapDegrees,
    solidReport: '064-source-cam-solids.json', solids: solids.summary, exit: solidExit,
    qualification: 'The finite cam, roller, pin and collar are isolated test solids. This does not certify an assembled production model or a physical no-slip roller trajectory.',
    firstTrace: '064-first-trace-source-cam-study.json',
    firstTraceCorrection: 'A circular base replaces small unwanted radial bumps in the first manual trace. The revised marked cam outline residual is below four scan pixels. Small finite-facet torque ripple remains.' },
  provisionalDynamics: { report: '064-inertial-snap-study-c.json', summary: dynamics.summary,
    convergence: '064-inertial-snap-convergence.json',
    alternatives: ['064-snap-dynamics-study.json', ...['a', 'b', 'd'].map(name => `064-inertial-snap-study-${name}.json`)],
    qualification: 'The first static minimum is not the final inertial settling angle. Candidate c passes it and settles on the circular base, with three releases and three catches and about 3.20 seconds per cycle below 0.001 rad/s before catch. These mass, spring and damping choices are provisional. The torque residual is algebraic; independent energy, contact-table convergence, impact and complete-hardware checks remain due.' },
  toothCountStudy: { file: '064-source-tooth-frequency.json',
    interpretation: 'Visible-boundary harmonic readings favor 23 and 24 nearly equally. The old 20 teeth are not justified by this evidence. Exact count and regularized worm proportions remain construction decisions.' },
  remaining: ['Build a complete source-sized model with a generated worm pair, separate bored shafts, a real half-cut sleeve, finite pin, roller and continuous leaf spring.',
    'Verify independent force/energy balance, contact-table convergence, catch behavior, physical roller spin and finite spring geometry.',
    'Check all independent actual 3D solids throughout complete motion, not just the isolated cam and collar.',
    'Integrate only after validation, set source/full views and readable timing, inspect captures and run build plus full numerical/browser regression.'],
};
await writeFile(directory + '064-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
console.log({ status: record.status, archives: archiveChecks.length, baselineInside: record.baseline.inside,
  isolatedSolidChecks: solids.summary.checks, isolatedSolidInside: solids.summary.inside });
