// Pass 109: fits 506's bevel tooth phases. For each mesh the first wheel's
// phase is held and its mate's is swept over one tooth pitch; at each trial
// the rendered teeth and bodies are sampled against each other (as in
// review-compound-epicyclic-teeth.mjs) at a few carrier poses, and the phase
// with no penetration and the widest least gap wins. Prints PHASES_506.
import fs from 'node:fs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAuthoredEpicyclicTrainMovement} from '../src/simulation/authored-epicyclic-trains.js';
import {PHASES_506} from '../src/simulation/compound-epicyclic-corrections.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[505];
const pairs=[['A','B'],['H','G'],['C','D'],['F','E']],STEPS=Number(process.env.STEPS??32),POSES=[0,.13,.37,.61,.83];
const gearParts=gear=>{const rotor=gear.userData.rotor,children=rotor.children.filter((c,i)=>i===0||c.userData.bevelTooth);
 const g=mergeGeometries(children.map(m=>{m.updateMatrix();let x=m.geometry.clone().applyMatrix4(m.matrix);if(x.index)x=x.toNonIndexed();for(const n of Object.keys(x.attributes))if(n!=='position')x.deleteAttribute(n);return x;}));
 return {rotor,surface:solidSurface(g),points:surfacePoints(g)};};
const measure=(first,second)=>{
 const model=createAuthoredEpicyclicTrainMovement(movement),b=model.root.userData.blocks,x=gearParts(b[`gear${first}`]),y=gearParts(b[`gear${second}`]);
 let gap=Infinity,pen=0;
 for(const f of POSES){model.update(model.root.userData.transmission.nominalCarrierPeriod*f);model.root.updateMatrixWorld(true);
  for(const[p,q]of[[x,y],[y,x]]){const m=q.rotor.matrixWorld.clone().invert().multiply(p.rotor.matrixWorld);
   for(const s of p.points){const t=s.clone().applyMatrix4(m);if(q.surface.box.distanceToPoint(t)>.1)continue;const d=q.surface.distance(t,.1);if(q.surface.inside(t)&&d>1e-6){pen++;gap=Math.min(gap,-d);}else gap=Math.min(gap,d);}}}
 disposeObject3D(model.root);return {gap,pen};
};
for(const[first,second]of pairs){
 const n=createAuthoredEpicyclicTrainMovement(movement).root.userData.transmission.teeth[second.toLowerCase()];
 let best=null;
 for(let k=0;k<STEPS;k++){PHASES_506[second]=2*Math.PI/n*k/STEPS;const r=measure(first,second);if(!best||(r.pen===0&&(best.pen>0||r.gap>best.gap))||(best.pen>0&&r.pen<best.pen))best={phase:PHASES_506[second],...r};}
 // refine
 const step=2*Math.PI/n/STEPS;for(let k=-4;k<=4;k++){PHASES_506[second]=best.phase+step*k/4;const r=measure(first,second);if(r.pen===0&&r.gap>best.gap)best={phase:PHASES_506[second],...r};}
 PHASES_506[second]=best.phase;console.log(first,second,n,best);
}
console.log(JSON.stringify(PHASES_506));
