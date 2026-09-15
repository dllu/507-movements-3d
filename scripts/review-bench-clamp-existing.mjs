import fs from 'node:fs';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createAuthoredClampMovement} from '../src/simulation/authored-clamps.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const m=createAuthoredClampMovement({id:174}),{blocks:b,geometry:g}=m.root.userData;
const meshes={},families={};
for(const [name,family]of [['upperJawPlate','upper'],['lowerJawPlate','lower'],['workpieceBody','board'],...['upper','lower'].flatMap(side=>['PivotScrewShaft','PivotWasher','PivotScrewHead'].map(part=>[side+part,'fixed']))]){meshes[name]=b[name];families[name]=family;}
b.benchPlanks.forEach((mesh,i)=>{meshes['bench'+i]=mesh;families['bench'+i]='fixed';});
const names=Object.keys(meshes),parts=Object.fromEntries(names.map(n=>[n,{surface:solidSurface(meshes[n].geometry),points:surfacePoints(meshes[n].geometry)}]));
const pairs=[];for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(families[names[i]]!==families[names[j]])pairs.push([names[i],names[j]]);
let queries=0,movingWithoutNominalContact=0;const intersections={},samples=[];
try {for(let i=0;i<=128;i++){
 const time=g.cyclePeriod*i/128;m.update(time);m.root.updateMatrixWorld(true);const s=m.root.userData.kinematics;
 if(Math.abs(s.upperJawAngularVelocity)>1e-5&&s.upperContactGap>1e-3)movingWithoutNominalContact++;
 if(i%16===0)samples.push({time,upperAngle:s.upperJawAngle,lowerAngle:s.lowerJawAngle,nominalGap:s.minimumContactGap,boardTranslation:s.workpieceTranslation});
 for(const [a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]){
  if(!new THREE.Box3().setFromObject(meshes[from]).intersectsBox(new THREE.Box3().setFromObject(meshes[to])))continue;
  const matrix=meshes[to].matrixWorld.clone().invert().multiply(meshes[from].matrixWorld);
  for(const p of parts[from].points){queries++;const q=p.clone().applyMatrix4(matrix);if(!parts[to].surface.inside(q))continue;const depth=parts[to].surface.distance(q);if(depth>1e-6)intersections[a+'/'+b]=Math.max(intersections[a+'/'+b]??0,depth);}
 }
 }
 const report={movement:174,status:'contact-reconstruction-open',poses:129,meshes:names.length,pairs,queries,intersections,movingWithoutNominalContact,samples,
 method:'Physical bench, jaw plates, board and pivot hardware, across distinct rigid families. Decorative outlines/indices/contact markers excluded. Finite vertices, edge midpoints and triangle centers; sampled baseline, not a clearance certificate. Moving-without-contact count uses the legacy model own nominal gap.',
 sources:['scripts/review-bench-clamp-existing.mjs','src/simulation/authored-clamps.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.argv[2]??'docs/validation/174-existing-contact.json',JSON.stringify(report,null,2)+'\n');console.log({intersections,queries,movingWithoutNominalContact});
}finally{disposeObject3D(m.root);}
