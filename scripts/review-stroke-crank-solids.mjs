import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createAuthoredStrokeCrankMovement} from '../src/simulation/authored-stroke-cranks.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const m=createAuthoredStrokeCrankMovement({id:175}),b=m.root.userData.blocks,meshes={},families={};
const groups=[[b.fixedFrame,'fixed'],[b.fixedShaft,'fixed'],[b.rearShaftCollar,'fixed'],[b.crank,'crank'],[b.crankPinShaft,'crank'],[b.slider,'slider'],[b.sliderPinShaft,'slider'],[b.rod,'rod']];
for(const [group,family]of groups)group.traverse(o=>{if(o.isMesh){const name=o.userData.role;assert.ok(name&&!meshes[name]);meshes[name]=o;families[name]=family;}});
const names=Object.keys(meshes),parts=Object.fromEntries(names.map(n=>[n,{surface:solidSurface(meshes[n].geometry),points:surfacePoints(meshes[n].geometry)}]));
const pairs=[];for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(families[names[i]]!==families[names[j]])pairs.push([names[i],names[j]]);
let queries=0;const intersections={};
const g=m.root.userData.geometry;
const times=[...Array.from({length:513},(_,i)=>8*i/512),...[1,2,g.lowerDeadCenterTurn+2,g.upperDeadCenterTurn].flatMap(turn=>[-1e-7,0,1e-7].map(offset=>(turn-g.sourcePoseTurn+offset)/g.crankTurnsPerSecond))];
try{for(const time of times){m.update(time);m.root.updateMatrixWorld(true);
 for(const [a,b]of pairs)for(const [from,to]of[[a,b],[b,a]]){
  if(!new THREE.Box3().setFromObject(meshes[from]).intersectsBox(new THREE.Box3().setFromObject(meshes[to])))continue;
  const matrix=meshes[to].matrixWorld.clone().invert().multiply(meshes[from].matrixWorld);
  for(const p of parts[from].points){queries++;const q=p.clone().applyMatrix4(matrix);if(!parts[to].surface.inside(q))continue;const depth=parts[to].surface.distance(q);if(depth>1e-6)intersections[a+'/'+b]=Math.max(intersections[a+'/'+b]??0,depth);}
 }}
 const report={movement:175,status:'rebuilt-assembly-sampled-clearance-passed',poses:times.length,meshes:names.length,pairs,queries,intersections,method:'All cross-rigid-family pairs at 513 uniform poses plus exact branch transfers, piston reversals and nearby poses. Finite mesh vertices, edge midpoints and face centers; excludes the nonphysical dashed orbit. Sampled clearance, not continuous proof.',sources:['scripts/review-stroke-crank-solids.mjs','src/simulation/authored-stroke-cranks.js','tests/helpers/solid-surface.mjs','src/simulation/finite-plate-geometry.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/175-assembly-clearance.json',JSON.stringify(report,null,2)+'\n');console.log({meshes:names.length,queries,intersections});assert.equal(Object.keys(intersections).length,0);
}finally{disposeObject3D(m.root);}
