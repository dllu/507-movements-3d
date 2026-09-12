import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchCandidate} from './lib/weighted-clutch-candidate.mjs';
import {prepareBevelSurfaces,sampleBevelPair} from './lib/bevel-working-surfaces.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-bevel-screen',steps=Number(process.env.PROBE_STEPS??12),
  frozen=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
  verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};
assert(Number.isInteger(steps)&&steps>=2);verify();
const sources=freezeStudySources(['scripts/probe-weighted-clutch-bevels.mjs','scripts/lib/weighted-clutch-candidate.mjs',
  'scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/study-report-io.mjs',
  'scripts/lib/bevel-working-surfaces.mjs','tests/helpers/solid-surface.mjs','src/simulation/bevel-geometry.js',
  'src/simulation/jaw-clutch-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js'],prefix),
  model=makeWeightedClutchCandidate(),u=model.root.userData,surfaces=Object.fromEntries(Object.entries(u.gears).map(([name,g])=>[name,prepareBevelSurfaces(g)])),rows=[];
for(let i=0;i<=steps;i++){
  const fraction=i/steps;model.setState({inputAngle:fraction*2*Math.PI/u.gears.input.userData.teeth,outputAngle:fraction*2*Math.PI/u.gears.pinion.userData.teeth});
  for(const[a,b]of [['input','B'],['input','C'],['pinion','E']])for(const[from,to]of [[a,b],[b,a]]){
    const row={fraction,from,to,...sampleBevelPair(surfaces[from],surfaces[to],{maximum:.03})};rows.push(row);
    console.log(JSON.stringify({fraction,from,to,gap:row.gap,inside:row.inside,checks:row.checks}));
  }
}
verify();verifyStudySources(sources);
const intrusions=rows.filter(r=>r.inside>0),minimumGap=Math.min(...rows.map(r=>r.gap)),checks=rows.reduce((s,r)=>s+r.checks,0);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  steps,checks,minimumGap,intrusions,rows,sources,
  qualification:'Bidirectional native triangle surface sample screen over one tooth pitch for all three bevel meshes. Signed distances use independent triangle surfaces. A clean sample screen alone does not establish continuous clearance, conjugate contact, load transfer, jaws, hidden supports or reversal mechanics.'},null,2)+'\n',{flag:'wx'});
console.log({checks,minimumGap,intrusions:intrusions.length});if(intrusions.length)process.exitCode=1;
