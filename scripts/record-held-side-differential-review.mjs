import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const catalog = await json('src/data/movements.json'), model = createMovementModel(catalog.movements[60]);
const labels = ['output-positive','output-negative','brake-positive','brake-negative'];
const flanks = await Promise.all(labels.map(label => json(`artifacts/review/061-candidate-flank-${label}.json`)));
const exact = await json('artifacts/review/061-candidate-exact-contact.json');
const hardware = await json('artifacts/review/061-candidate-hardware.json'), solids = await json('artifacts/review/061-candidate-solids.json');
const motion = await json('artifacts/review/061-candidate-motion-check.json'), alignment = await json('artifacts/review/061-source-alignment.json');
const numerical = await json('artifacts/review/061-numerical-exit-status.json').catch(() => null);
const numericalLog = await readFile('artifacts/review/061-numerical-exit-check.log','utf8').catch(() => '');
const browserLog = await readFile('artifacts/review/061-browser-tests.log','utf8').catch(() => '');
const browserExit = await json('artifacts/review/061-browser-exit-status.json').catch(() => null);
const buildLog = await readFile('artifacts/review/061-build.log','utf8'), focusedLog = await readFile('artifacts/review/061-focused-tests.log','utf8');
const files = (await readdir('artifacts/review')).filter(f => /^061-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const browserResult = browserLog.match(/21 passed[^\n]*/)?.[0] ?? null;
const solidIssues = solids.filter(v => v.volume <= 0 || v.zeroFaces || v.badNormals || v.unpairedEdges || v.inconsistentEdges);
const complete = numerical?.code === 0 && browserExit?.code === 0 && browserResult && /built in/.test(buildLog)
  && /# pass 5\n/.test(focusedLog) && files.length === 6 && !solidIssues.length && hardware.inside === 0
  && flanks.every(report => report.summary.every(row => row.rows === 129 && row.intersections === 0
    && row.minimumGap > 0.00002 && row.maximumGap < 0.00008 && row.maximumPowerResidual < 0.004))
  && exact.rows.length === 61 && exact.rows.every(row => row.kind === 'hardware-clearance' ? row.distance > 1e-6
    : row.witness && row.distance > 0.00012 && row.distance < 0.00020)
  && motion.maximumRelativeNeutralSlip < 1e-9 && motion.stoppedShifts >= 4;
const record = {
  movement:61, status:complete?'rebuilt-and-verified':'rebuilt-verification-pending',
  source:'https://507movements.com/mm_061.html', reference:'../reference/brown-061-detail.png',
  interpretation:'One flat band selects a loose neutral pulley, a pulley fixed to the output shaft, or a pulley carrying a transverse bevel planet. The opposite side bevel is held by a weighted friction curb. Direct drive gives the input speed; carrier drive gives double output speed. The compact train sits inside hollow pulley bodies.',
  sourceChoices:'Measured side envelopes determine large smooth pulleys, compact enclosed bevel train and small brake drum. Equal 26-tooth side gears and a 20-tooth planet share complementary pitch cones and approximate the hidden radial/axial proportions; Brown gives no tooth counts or concealed bearing details.',
  sourceLimits:'A continuous band fills the torn-end interruption. Drawn shaft/pulley centers disagree slightly; all measured body/shaft/drum outline residuals are within nine scan pixels, excluding schematic band arches and hidden construction. No official animation is available. Stopped shifts and fixed brake restraint are inferred demonstration choices.',
  geometry:model.root.userData.geometry, timing:model.root.userData.animationTiming,
  camera:{source:model.cameraDirection.toArray(),full:model.root.userData.fullCameraDirection.toArray(),groundHidden:true,sectionToggle:true},
  evidence:{
    sourceMeasurements:'061-source-envelope-measurement.json',interactiveSourceOverlay:'061-source-alignment.html',
    sourceResiduals:alignment.rows.map(({name,topResidual,bottomResidual})=>({name,topResidual,bottomResidual})),
    bevelFlanks:{summary:flanks.flatMap(report=>report.summary),reports:labels.map(label=>`061-candidate-flank-${label}.json`)},
    independentTriangleContact:{report:'061-candidate-exact-contact.json',rows:exact.rows.length,
      minimumWorkingGap:Math.min(...exact.rows.filter(row=>row.kind!=='hardware-clearance').map(row=>row.distance))},
    hardware:{poses:hardware.poses,pairs:hardware.pairs.length,checks:hardware.checks,inside:hardware.inside,report:'061-candidate-hardware.json'},
    solids:{geometries:solids.length,issues:solidIssues,report:'061-candidate-solids.json'},
    motion:{...motion,report:'061-candidate-motion-check.json'},
    defaultBevelCompatibility:'061-bevel-default-compatibility.json',
    focusedTests:{passed:Number(focusedLog.match(/# pass (\d+)/)?.[1])||null,log:'061-focused-tests.log'},
    numericalTests:{passed:Number(numericalLog.match(/# pass (\d+)/)?.[1])||null,exit:numerical,log:'061-numerical-exit-check.log'},
    browserTests:{result:browserResult,exit:browserExit,log:'061-browser-tests.log'},
    build:{passed:/built in/.test(buildLog),log:'061-build.log'},sourceComparisons:files,
    inspectedViews:'Candidate section/source/oblique/rear/shift/quick and complete views, both source overlays, and six integrated section/complete frames.',
  },
  baseline:{factory:'061-original-factory.txt',tests:'061-original-test.txt',hardware:'061-hardware-baseline.json',exactHardware:'061-exact-hardware-baseline.json',bevels:'061-bevel-contact-baseline.json',
    failures:'An oversized exposed differential replaces the small hidden train. The carrier sleeve intersects the output bevel body/hub; shafts and carrier arm cross; the brake drum lacks shaft clearance. Round belt and friction curb penetrate their drums/rims. The source camera is reversed.'},
  rendering:'The full physical model retains closed geometry. Local clipping removes the front halves of the two hollow pulley cases in section view; fixed nonphysical caps close the display cut. Physical transforms and clearance evidence are unchanged by the toggle. Ground is hidden.',
  evidenceLimits:'Finite sweeps and tessellation clearances do not certify arbitrary unsampled collision freedom. The bevels use a back-cone involute approximation with conical ends; maximum pairwise contact-normal power residual is below 0.211 percent in the carrier frame. Brake holding, bearings and axial retention are ideal constraints. Transient friction, elasticity and inertia are not solved.',
};
await writeFile('artifacts/review/061-reconstruction.json',JSON.stringify(record,null,2)+'\n');
const galleryPath='artifacts/review/index.html',existing=await readFile(galleryPath,'utf8');
const galleryFiles=(await readdir('artifacts/review')).filter(f=>/^\d{3}-(?:full-)?phase-[\d_]+\.png$/.test(f)).sort();
const prefix=existing.slice(0,existing.indexOf('<div class="grid">')+'<div class="grid">'.length);
await writeFile(galleryPath,prefix+'\n'+galleryFiles.map(f=>`<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"><span>${f}</span></a>`).join('\n')+'\n</div></html>\n');
console.log({status:record.status,numerical:record.evidence.numericalTests.passed,browserResult,comparisons:galleryFiles.length});
