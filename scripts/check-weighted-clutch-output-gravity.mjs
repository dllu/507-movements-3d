import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {makeWeightedClutchOutputGravity} from './lib/weighted-clutch-output-gravity.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-output-gravity-check',parent=readStudyReport('artifacts/review/087-first-gravity-shift.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),'scripts/check-weighted-clutch-output-gravity.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),inertia=makeWeightedClutchInertia(model),gravity=makeWeightedClutchOutputGravity(model,inertia),rows=[];
let maximumPotentialError=0,maximumDerivativeError=0;
for(let i=0;i<=256;i++){
 const phi=12*Math.PI*(i/256-.5),value=gravity.at(phi),native=gravity.nativePotential(phi),h=1e-5,
  derivative=(gravity.nativePotential(phi+h)-gravity.nativePotential(phi-h))/(2*h),potentialError=Math.abs(native-value.potential),derivativeError=Math.abs(derivative-value.derivative);
 maximumPotentialError=Math.max(maximumPotentialError,potentialError);maximumDerivativeError=Math.max(maximumDerivativeError,derivativeError);
 rows.push({phi,native,expected:value.potential,derivative,expectedDerivative:value.derivative,potentialError,derivativeError});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
 parameters:gravity.parameters,rows,maximumPotentialError,maximumDerivativeError,
 qualification:'Native world-centroid potential and independent finite differences validate both output-gravity harmonics at 257 angles over the common period. Uses the same explicit additive-component masses; no counterweight or historical material claim.'},null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,waves:gravity.parameters.waves,maximumPotentialError,maximumDerivativeError});
assert(maximumPotentialError<1e-9&&maximumDerivativeError<1e-7);
