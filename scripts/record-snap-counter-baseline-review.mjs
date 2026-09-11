import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'artifacts/review/';
const json = async file => JSON.parse(await readFile(directory + file, 'utf8'));
const source = await readFile('src/simulation/authored-intermittent.js', 'utf8');
const tests = await readFile('tests/models.test.mjs', 'utf8');
const archives = ['factory', 'makeStarWheel', 'makePinnedDriver', 'makeSpringDrop', 'makePawl', 'test'];
const archiveChecks = await Promise.all(archives.map(async name => {
  const file = `063-original-${name}.txt`, text = (await readFile(directory + file, 'utf8')).trim();
  const matchesProduction = (name === 'test' ? tests : source).includes(text);
  if (!matchesProduction) throw new Error(`Original 063 archive no longer matches production: ${file}`);
  return { file, matchesProduction, sha256: createHash('sha256').update(text).digest('hex') };
}));
const contacts = await json('063-contact-baseline.json');
const tracing = await json('063-source-tracing.json');
const cams = await json('063-source-cam-study.json');
const reverse = await json('063-source-cam-study-counterclockwise.json');
const movingHingeStudies = [];
for (const file of (await readdir(directory)).filter(name => name.startsWith('063-') && name.endsWith('.json')).sort()) {
  const study = await json(file);
  if (study.status !== 'provisional-moving-hinge-flexure-study') continue;
  const events = study.eventStates ?? [];
  const advances = events.slice(1).map((row, index) => ({
    event: row.phase, toothSteps: (row.gamma - events[index].gamma) / (Math.PI / 5),
  }));
  movingHingeStudies.push({ file, parameters: study.parameters, poses: study.rows,
    requestedPoses: study.requestedPoses, issues: study.issues.length,
    firstIssue: study.issues[0] ?? null, outputToothSteps: study.outputToothSteps,
    eventAdvances: advances, demonstratesRepeatedIndexing: advances.length >= 3
      && advances.slice(1).every(row => Math.abs(Math.abs(row.toothSteps) - 1) < 1e-4) });
}
if (movingHingeStudies.some(study => study.demonstratesRepeatedIndexing)) {
  throw new Error('A study now indexes repeatedly: inspect it and revise this unresolved review before recording.');
}
const record = {
  movement: 63, status: 'mechanically-unresolved-production-replacement-pending',
  source: 'https://507movements.com/mm_063.html', reference: '../reference/brown-063-detail.png',
  notes: '063-reconstruction-notes.md',
  sourceInterpretation: 'Three disk pins lift a spring-loaded drop and its pawl. The pawl escapes first and enters the next star space. Subsequent drop escape lets its striker drive the pawl and advance the ten-point star. The broad front pawl hinges on the rear drop at the large upper joint, which moves with the spring-carried assembly. A ground-fixed upper joint cannot establish repeated indexing. Exact spring support and finite driving surfaces remain unresolved.',
  additionalReferences: [
    { file: '../reference/spons-v5.pdf', figure: 3186, pdfPages: [117, 118],
      inspectedCrop: '../reference/spons-3186-detail.png', finding: 'The figure and description repeat the same anatomy and release sequence; they do not resolve spring support geometry.' },
    { source: 'https://engineering.stackexchange.com/questions/52770/how-does-this-pawl-mechanism-work',
      author: 'Sam Gallagher', date: '2022-10-07', file: '../reference/sam-gallagher-063-answer.json',
      finding: 'The author describes his own approximate reconstruction: a moving assembly hinge, a striker limiting upward pawl rotation, and no pin/star interface. This is not manufacturing evidence.',
      animationInspected: false, animationUrl: 'https://i.sstatic.net/CuYwj.gif',
      retrieval: 'The Stack CDN returned HTTP 403. The old Imgur URL returned a 161 by 81 PNG unavailable-image placeholder, not the animation.',
      unavailablePlaceholder: '../reference/sam-gallagher-063-unavailable-placeholder.png' },
  ],
  archiveChecks, parameters: '063-baseline-parameters.json',
  baseline: { report: '063-contact-baseline.json', poses: contacts.poses,
    maximumPinCenterError: contacts.maximumPinCenterError,
    checks: contacts.summary.reduce((sum, row) => sum + row.checks, 0),
    inside: contacts.summary.reduce((sum, row) => sum + row.inside, 0), summary: contacts.summary,
    exit: await json('063-contact-baseline-exit-status.json'),
    interpretation: 'The diagnostic completed successfully and found mechanical defects. A zero process exit is not a passing-clearance claim.',
    captures: ['0', '0_43', '0_63', '0_78'].map(phase => `063-baseline-phase-${phase}.png`),
    captureLog: '063-baseline-capture.log', capturesInspected: true },
  provisionalStudy: {
    sourceTrace: '063-source-tracing.html', dimensions: '063-source-tracing.json', traceData: '063-provisional-source-layout.mjs',
    maximumPinCenterResidualPixels: tracing.maximumPinCenterResidual,
    inspectedTraces: ['063-source-tracing.png', '063-source-tracing-drop.png', '063-source-tracing-pawl.png'],
    camStudy: '063-source-cam-study.json', poses: cams.poses, sampledInterferences: cams.issues.length,
    pawlEscapes: cams.pawlEscapeSteps, dropEscapes: cams.dropEscapeSteps,
    maximumPawlRisePerStep: cams.maximumPawlRisePerStep, maximumDropRisePerStep: cams.maximumDropRisePerStep,
    reverseStudy: '063-source-cam-study-counterclockwise.json',
    reverseMaximumPawlRisePerStep: reverse.maximumPawlRisePerStep,
    reverseMaximumDropRisePerStep: reverse.maximumDropRisePerStep,
    supersededGlobalMinimumStudy: '063-source-cam-study-global-minimum.json',
    qualification: 'This historical fixed-upper-pivot study only checks the traced plates, pins and striker. It omits the star and cannot establish repeated indexing. Its smooth lift/release order is not evidence that a ground-fixed upper joint is correct.' },
  movingHingeStudy: {
    script: '../../scripts/study-snap-counter-flexure.mjs',
    helper: '../../scripts/lib/snap-counter-planar-study.mjs',
    studies: movingHingeStudies, count: movingHingeStudies.length,
    totalPoses: movingHingeStudies.reduce((sum, study) => sum + study.poses, 0),
    repeatedIndexingPasses: 0,
    conclusion: 'No tested variant establishes repeated one-tooth advance. Zero sampled interferences and process exit zero are not mechanical passes.',
    limitations: [
      'These are planar sampled quasi-static studies, not production solids or finite release dynamics.',
      'The solver holds the star unless the striker bounds the pawl, and then selects the nearest clearing output angle. It does not solve all hinge/contact forces or verify positive contact reactions.',
      'A finite nose seated on two valley flanks may couple the moving hinge and star before the striker acts; that constraint is not represented by the current solver.',
      'Some early reverse-direction failures came from interpolating a lifting drop against already-advanced pins. Corrected reverse-direction studies complete but still do not index repeatedly.',
      'Support, toe depth steps, profile extensions, radii, offsets and stops are construction hypotheses, not details established by the engraving.',
    ],
    starMeasurement: await json('063-star-source-measurement.json'),
  },
  remaining: ['Resolve the true finite pawl/star driving surfaces, output direction and exactly one-tooth advance.',
    'Replace escape discontinuities with a finite spring-driven stroke that respects pin, striker and star contacts.',
    'Build source-sized closed solids with real pivot bores and separated independent plates.',
    'Verify complete motion, actual contact forces and all independent 3D hardware, then tune display speed and inspect final frames.',
    'Run the build, focused mechanical tests and full numerical/browser regression after integration.'],
};
await writeFile(directory + '063-reconstruction.json', JSON.stringify(record, null, 2) + '\n');
console.log({ status: record.status, productionArchivesMatched: archiveChecks.length,
  baselinePoses: contacts.poses, baselineInside: record.baseline.inside, provisionalCamPoses: cams.poses,
  movingHingeStudies: movingHingeStudies.length, repeatedIndexingPasses: 0 });
