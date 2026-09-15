import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {makeWaveCamContactSolver} from '../src/simulation/mujoco-wave-cam/quasistatic.js';
import {waveCamSampledGap} from '../src/simulation/mujoco-wave-cam/clearance.js';
const solver=makeWaveCamContactSolver(),fine=makeWaveCamContactSolver({samples:256}),states=[];let refinement=0,minimumGap=Infinity,maximumSeatedGap=0,residual=0;
for(let i=0;i<=720;i++){
 const cam=2*Math.PI*i/720,s=solver.solve(cam);s.time=12*i/720;states.push(s);residual=Math.max(residual,Math.abs(s.residual));
 const gap=waveCamSampledGap(s,{samples:1024,profileType:'radial'}).gap;minimumGap=Math.min(minimumGap,gap);maximumSeatedGap=Math.max(maximumSeatedGap,gap);
 if(i%2===0)refinement=Math.max(refinement,Math.abs(s.outputY-fine.solve(cam).outputY));
}
const sources=['scripts/probe-wave-cam-quasistatic.mjs','src/simulation/mujoco-wave-cam/quasistatic.js','src/simulation/mujoco-wave-cam/projected-profile.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco-wave-cam/clearance.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={movement:165,status:'quasistatic-contact-checked',assumptions:'Ideal massless/quasistatic follower held against the cam by the weighted output bar. Pin and vertical-guide constraints are ideal. No inertia, friction, bounce or load-capacity claim. Margin 0.006 world units. Twelve-second display revolution is illustrative, not a specified physical operating speed.',poses:states.length,refinementPoses:361,maximumOutputRefinementDifference:refinement,minimumIndependentSampledGap:minimumGap,maximumIndependentSeatedGap:maximumSeatedGap,maximumRootResidual:residual,outputEndpointDifference:states.at(-1).outputY-states[0].outputY,initial:states[0],sources};
assert.ok(refinement<1e-8&&minimumGap>.0059&&maximumSeatedGap<.0064&&residual<2e-10,'finite contact refinement/clearance bounds');
fs.writeFileSync('/dev/shm/165-quasistatic-states.json',JSON.stringify(states));fs.writeFileSync('docs/validation/165-quasistatic.json',JSON.stringify(report,null,2)+'\n');console.log(report);
