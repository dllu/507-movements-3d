import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeMutilatedBevelCandidate } from './lib/mutilated-bevel-candidate.mjs';
import { applySectorRelief } from './lib/mutilated-bevel-tooth-relief.mjs';
import { makeMutilatedBevelSplineMotion } from './lib/mutilated-bevel-contact-spline.mjs';
import { prepareBevelSurfaces, sampleBevelPair } from './lib/bevel-working-surfaces.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
import { setSpin } from '../src/simulation/primitives.js';

const bakeFile=process.argv[2]??'artifacts/review/074-contact-spline-bake.json',bake=JSON.parse(await readFile(bakeFile,'utf8')),
  relief=JSON.parse(await readFile(bake.relief,'utf8')),reference=JSON.parse(await readFile(bake.motionFile,'utf8')),
  model=makeMutilatedBevelCandidate(relief.parameters),motion=makeMutilatedBevelSplineMotion(bake.profile);applySectorRelief(model,relief);
const {blocks:b,geometry:p}=model.root.userData,prepared=Object.fromEntries(Object.entries(b).map(([name,gear])=>[name,prepareBevelSurfaces(gear)])),
  trees=new Map(),tree=mesh=>{if(!trees.has(mesh.geometry))trees.set(mesh.geometry,triangleTree(mesh.geometry));return trees.get(mesh.geometry);};
const pose=u=>{
  model.update((u-p.initialCyclePhase)*p.period);setSpin(b.gearA,motion.atCoordinate(u).angle);setSpin(b.gearB,motion.atCoordinate(u+.5).angle);model.root.updateMatrixWorld(true);
};
const coordinates=[...Array.from({length:193},(_,i)=>2.25+(i+.371)/193),...bake.worstValidation.map(r=>2.25+r.x)];
for(const event of reference.releaseExtrema.filter(r=>r.coordinate>2.25))for(const delta of [-1e-5,-1e-7,0,1e-7,1e-5])coordinates.push(event.coordinate+delta);
for(const u of [2.4875,2.9875])for(const delta of [-.01,-.005,-.001,-1e-6,0,1e-6,.001,.005,.01])coordinates.push(u+delta);
const hardware=[],pairs=[['gearA','driverC'],['driverC','gearA'],['gearB','driverC'],['driverC','gearB'],['gearA','gearB'],['gearB','gearA']];
for(const coordinate of coordinates){
  pose(coordinate);const boxes=Object.fromEntries(Object.entries(b).map(([name,gear])=>[name,new THREE.Box3().setFromObject(gear)]));
  for(const [first,last]of pairs){
    const a=boxes[first],c=boxes[last],lowerBound=Math.hypot(...['x','y','z'].map(axis=>Math.max(0,a.min[axis]-c.max[axis],c.min[axis]-a.max[axis])));
    const result=lowerBound>.08?{gap:lowerBound,checks:0,inside:0,boxSeparated:true}:sampleBevelPair(prepared[first],prepared[last]);
    hardware.push({coordinate,first,last,...result});
  }
}
const contacts=[];
for(const sample of reference.rows.filter(r=>r.step>reference.steps*(reference.cycles-1)&&r.contact&&r.advance>1e-8).filter((r,i)=>i%8===0)){
  pose(sample.coordinate);const A=b.gearA.userData.toothMeshes.find(m=>m.userData.index===sample.contact.outputTooth),
    C=b.driverC.userData.toothMeshes.find(m=>m.userData.index===sample.contact.driverTooth),
    result=meshPairDistance(tree(C),tree(A),A.matrixWorld.clone().invert().multiply(C.matrixWorld),1e-4);
  contacts.push({coordinate:sample.coordinate,distance:result.distance,testedTriangles:result.testedTriangles});
}
const report={movement:74,status:'isolated-spline-skin-audit',productionChanged:false,bakeFile,poses:coordinates.length,hardware,contacts,
  checks:hardware.reduce((s,r)=>s+r.checks,0),inside:hardware.reduce((s,r)=>s+r.inside,0),minimumGap:Math.min(...hardware.map(r=>r.gap)),
  maximumContactDistance:Math.max(...contacts.map(r=>r.distance)),
  qualification:'Actual Float32 skins for all independent gear/body/shaft families, driven by the interpolated motion at fresh cycle fractions, worst bake-validation errors, and both sides of the refined release events. All six directed pairs are covered; separated world boxes are rejected conservatively. Exact triangle distances independently verify selected active tooth pairs. This is sampled runtime-candidate verification, not a continuous mathematical certificate or production regression.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-contact-spline-skins.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,checks:report.checks,inside:report.inside,minimumGap:report.minimumGap,contacts:contacts.length,maximumContactDistance:report.maximumContactDistance});
if(report.inside||report.maximumContactDistance>1e-6)process.exitCode=1;
