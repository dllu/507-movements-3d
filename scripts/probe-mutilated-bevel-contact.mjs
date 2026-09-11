import{readFile,writeFile}from'node:fs/promises';import * as THREE from'three';
import{makeMutilatedBevelCandidate}from'./lib/mutilated-bevel-candidate.mjs';
import{applySectorRelief}from'./lib/mutilated-bevel-tooth-relief.mjs';
import{triangleTree,meshPairDistance}from'./lib/star-mangle-pair-distance.mjs';

const file=process.argv[2]??'artifacts/review/074-continuous-relief-study.json',relief=JSON.parse(await readFile(file,'utf8')),
  model=makeMutilatedBevelCandidate(relief.parameters);applySectorRelief(model,relief);
const{blocks:b,geometry:p}=model.root.userData,cache=new Map(),tree=mesh=>{
  if(!cache.has(mesh.geometry)){mesh.geometry.computeBoundingBox();cache.set(mesh.geometry,triangleTree(mesh.geometry));}return cache.get(mesh.geometry);
};
for(const gear of [b.gearA,b.driverC])for(const tooth of gear.userData.toothMeshes)tree(tooth);
const rows=[],start=.5-p.shiftTeeth/p.driverTeeth,end=1-p.shiftTeeth/p.driverTeeth;
const coordinates=[...Array.from({length:81},(_,i)=>start+(end-start)*i/80),start-1e-6,start+1e-6,end-1e-6,end+1e-6];
for(const coordinate of coordinates){
  model.update((coordinate-p.initialCyclePhase)*p.period);model.root.updateMatrixWorld(true);
  let closest={distance:.04,witness:null,testedTriangles:0},pair=null,testedTriangles=0;
  const worldBoxes=new Map([...b.gearA.userData.toothMeshes,...b.driverC.userData.toothMeshes].map(mesh=>[mesh,mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)]));
  for(const a of b.driverC.userData.toothMeshes)for(const target of b.gearA.userData.toothMeshes){
    const aa=worldBoxes.get(a),bb=worldBoxes.get(target),dx=Math.max(0,aa.min.x-bb.max.x,bb.min.x-aa.max.x),
      dy=Math.max(0,aa.min.y-bb.max.y,bb.min.y-aa.max.y),dz=Math.max(0,aa.min.z-bb.max.z,bb.min.z-aa.max.z);
    if(dx*dx+dy*dy+dz*dz>=closest.distance**2)continue;
    const result=meshPairDistance(tree(a),tree(target),target.matrixWorld.clone().invert().multiply(a.matrixWorld),closest.distance);testedTriangles+=result.testedTriangles;
    if(result.witness&&result.distance<closest.distance){closest=result;pair={a,target};}
  }
  if(!pair)throw new Error('No tooth pair within contact-search radius');
  const point=new THREE.Vector3(...closest.witness.b).applyMatrix4(pair.target.matrixWorld),
    normal=new THREE.Vector3(...closest.witness.bNormal).transformDirection(pair.target.matrixWorld),
    omegaC=-2*Math.PI/p.period,omegaA=p.ratio*2*Math.PI/p.period,
    velocityC=b.driverC.userData.axis.clone().multiplyScalar(omegaC).cross(point),
    velocityA=b.gearA.userData.axis.clone().multiplyScalar(omegaA).cross(point);
  rows.push({coordinate,indexing:model.root.userData.kinematics.indexingA,distance:closest.distance,testedTriangles,
    driverTooth:pair.a.userData.index,outputTooth:pair.target.userData.index,point:point.toArray(),normal:normal.toArray(),
    relativeNormalSpeed:velocityC.sub(velocityA).dot(normal),
    outputTorquePerNormalForce:point.clone().cross(normal.clone().negate()).dot(b.gearA.userData.axis),witness:closest.witness});
}
const report={movement:74,status:'isolated-rendered-tooth-distance-study',relief:file,rows,
  maximumActiveDistance:Math.max(...rows.filter(r=>r.indexing).map(r=>r.distance)),
  minimumActiveDistance:Math.min(...rows.filter(r=>r.indexing).map(r=>r.distance)),
  qualification:'Exact triangle-skin closest distances, including vertex/face, edge/edge and face crossings, for every possible C/A tooth pair in the active interval and near its boundaries. Normal-speed and torque diagnostics use the closest output face normal; positive separation is not actual contact and does not establish a force reaction.'};
await writeFile('artifacts/review/074-relieved-tooth-contact.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({maximumActiveDistance:report.maximumActiveDistance,minimumActiveDistance:report.minimumActiveDistance,rows:rows.length,
  maximumRelativeNormalSpeed:Math.max(...rows.filter(r=>r.indexing).map(r=>Math.abs(r.relativeNormalSpeed)))});
