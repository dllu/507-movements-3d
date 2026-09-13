import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchCandidate} from './lib/weighted-clutch-candidate.mjs';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {clutchSourceProjection,clutchSourceContourComparison,auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {distributedClutchSources} from './lib/weighted-clutch-distributed-sources.mjs';
import {makeWeightedClutchNativeCouplings} from './lib/weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchFastStud} from './lib/weighted-clutch-fast-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-fixed-orbit-geometry',
  input=process.env.PROBE_INPUT??'artifacts/review/087-first-fixed-orbit-fit.json',fit=readStudyReport(input),
  oldFile='artifacts/review/087-first-distributed-geometry.json',old=readStudyReport(oldFile),
  sources=freezeStudySources([...distributedClutchSources,input,oldFile,'scripts/check-weighted-clutch-fixed-orbit-geometry.mjs',
    'scripts/lib/weighted-clutch-fit-audit.mjs','scripts/lib/weighted-clutch-solid-audit.mjs',
    'scripts/lib/weighted-clutch-native-contours.mjs','scripts/lib/weighted-clutch-native-couplings.mjs',
    'scripts/lib/weighted-clutch-fast-stud.mjs','scripts/lib/weighted-clutch-native-stud.mjs','tests/helpers/solid-surface.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(fit.options),reference=makeWeightedClutchCandidate(),
  previous=makeWeightedClutchKeyCandidate(),distributed=makeWeightedClutchDistributedCandidate(old.options),comparisons=[];
verifyStudySources(fit.sources);verifyStudySources(old.sources);
previous.setCoordinates([0,previous.root.userData.lostMotion.parameters.shifterRight,0,0,0],0);
for(const[name,candidate]of [['previous75',previous],['distributed24',distributed],['fixedOrbit',model]]){
  const projection=clutchSourceProjection(candidate),contours=clutchSourceContourComparison(candidate,reference);
  comparisons.push({name,projection,contours});
  console.log({name,landmarkMaximum:projection.maximum,landmarkMean:projection.mean,studInsideMargin:projection.studInsideMargin,
    contourMean:contours.mean,contourRms:contours.rms,contourMaximumUpperBound:contours.maximumUpperBound});
}
const finerContours=clutchSourceContourComparison(model,reference,.75),selected=comparisons.at(-1),
  contourMeanDifference=Math.abs(finerContours.mean-selected.contours.mean),
  solids=auditClutchSourceSolids(model),u=model.root.userData,coupling=makeWeightedClutchNativeCouplings(model),
  q=[0,u.lostMotion.parameters.shifterRight,0,0,0],couplings=coupling.query(q),initialStud=makeWeightedClutchFastStud(model).evaluate(0,0);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,input,options:fit.options,state:u.state,sourceAdjustments:u.sourceAdjustments,comparisons,finerContours,contourMeanDifference,
  ...solids,couplings,initialStud,
  qualification:'Static native geometry and registered contour comparison for the fixed-orbit source fit. Nine part contours are compared bidirectionally with the measured source model, including the slot and E openings. This is not an ink-image or occlusion-aware metric. A finer contour quadrature checks sampling sensitivity; the maximum bound uses distance Lipschitz continuity. Full-motion clearance and new dynamics are not established by the source-pose solid screen.'},null,2)+'\n',{flag:'wx'});
console.log({solids:solids.topology.length,checks:solids.checks,issues:solids.issues,topologyIssues:solids.topologyIssues,
  contourMeanDifference,minimumCouplingGap:Math.min(...couplings.map(c=>c.gap)),initialStudGap:initialStud.gap});
assert(!solids.topologyIssues.length&&!solids.issues.length&&couplings.every(c=>c.gap> -1e-9)&&initialStud.gap>=0);
assert(selected.projection.maximum<=fit.selected.radius+1e-8&&selected.projection.studInsideMargin>32&&selected.projection.pinionAxisOffset===0);
assert(contourMeanDifference<.01);
