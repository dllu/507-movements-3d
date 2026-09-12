import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchPrimaryBounds} from './lib/pump-catch-primary-bounds.mjs';
import {poly,plate} from '../src/simulation/finite-plate-geometry.js';
import {freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-primary-controls',cases=[
  {name:'shared-face',moving:[[1,0],[1.1,-.1],[1.1,.1]],obstacle:[[-1,-1],[1,-1],[1,1],[-1,1]],angles:[0,0],passed:true},
  {name:'penetrating',moving:[[.99,0],[1.1,-.1],[1.1,.1]],obstacle:[[-1,-1],[1,-1],[1,1],[-1,1]],angles:[0,0],passed:false},
  {name:'sweep-enters-between-clear-endpoints',moving:[[.99,-.01],[1.01,-.01],[1,.01]],obstacle:[[.9,-.1],[1.1,-.1],[1.1,.1],[.9,.1]],angles:[-Math.PI/2,Math.PI/2],passed:false},
  {name:'clear-circular-sweep',moving:[[.99,-.01],[1.01,-.01],[1,.01]],obstacle:[[2,-.1],[2.2,-.1],[2.2,.1],[2,.1]],angles:[-Math.PI/2,Math.PI/2],passed:true},
],results=[];
for(const c of cases){
  const model=makePumpCatchCandidate(),u=model.root.userData;u.geometry.pivot=[0,0];u.blocks.catch.position.set(0,0,0);
  u.parts.hookedCatchB.geometry.dispose();u.parts.hookedCatchB.geometry=plate(poly(c.moving),0,.13);
  u.parts.pointedCamC.geometry.dispose();u.parts.pointedCamC.geometry=plate(poly(c.obstacle),0,.13);
  const bounds=makePumpCatchPrimaryBounds(model,{onlyPairs:['cam']}),a={time:0,q:[0,c.angles[0],0]},b={time:1,q:[0,c.angles[1],0]},r=bounds.interval(a,b,0);
  assert.equal(r.passed,c.passed,c.name);
  if(c.name==='sweep-enters-between-clear-endpoints')for(const q of [a.q,b.q])assert(bounds.interval({time:0,q},{time:1,q},0).passed);
  results.push({name:c.name,expected:c.passed,...r});
}
const sources=freezeStudySources(['scripts/check-pump-catch-primary-controls.mjs','scripts/lib/pump-catch-primary-bounds.mjs',
  'scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','scripts/lib/study-report-io.mjs'],prefix),report={movement:86,passed:true,results,sources,
  qualification:'Controls exercise shared-face acceptance, finite overlap rejection, a collision between clear endpoint poses and a fully clear curved sweep. The interior collision also tests curvature-expanded broad-phase coverage.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
