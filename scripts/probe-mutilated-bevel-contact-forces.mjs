import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeMutilatedBevelCandidate } from './lib/mutilated-bevel-candidate.mjs';
import { applySectorRelief, toothChart } from './lib/mutilated-bevel-tooth-relief.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
import { prepareBevelAngularOverlap } from './lib/bevel-angular-overlap.mjs';
import { setSpin } from '../src/simulation/primitives.js';

const motionFile=process.argv[2]??'artifacts/review/074-cleaned-contact-motion-1440.json',motion=JSON.parse(await readFile(motionFile,'utf8'));
const relief=JSON.parse(await readFile(motion.relief,'utf8')),model=makeMutilatedBevelCandidate(relief.parameters);applySectorRelief(model,relief);
const {blocks:b,geometry:p}=model.root.userData,overlap=prepareBevelAngularOverlap(b.gearA,b.driverC),trees=new Map();
const tree=mesh=>{if(!trees.has(mesh.geometry))trees.set(mesh.geometry,triangleTree(mesh.geometry));return trees.get(mesh.geometry);};
const sphere=1.3288446161493823;
function rings(mesh){
  const polygons=mesh.geometry.userData.polygons??[[toothChart(mesh.geometry)]];
  return polygons.flat().map(ring=>ring.map(([x,y])=>new THREE.Vector3(x,y,1).transformDirection(mesh.matrixWorld)));
}
function vertexEdges(vertices,edges,forceSign){
  const contacts=[];
  for(const ring of vertices)for(const vertex of ring)for(const target of edges)for(let i=0;i<target.length;i++){
    const a=target[i],z=target[(i+1)%target.length],normal=a.clone().cross(z).normalize().negate();
    const angle=a.angleTo(z);if(angle<1e-12)continue;
    const tangent=z.clone().addScaledVector(a,-a.dot(z)).normalize();
    const t=Math.atan2(vertex.dot(tangent),vertex.dot(a))/angle,distance=vertex.dot(normal)*sphere;
    if(t< -1e-7||t>1+1e-7||Math.abs(distance)>3e-6)continue;
    const point=vertex.clone().multiplyScalar(sphere),force=normal.multiplyScalar(forceSign),moment=point.clone().cross(force),
      outputTorque=moment.dot(b.gearA.userData.axis),driverMoment=moment.dot(b.driverC.userData.axis);
    contacts.push({distance,point:point.toArray(),force:force.toArray(),outputTorque,driverMoment,ratio:-driverMoment/outputTorque});
  }
  return contacts;
}
function loadedAngle(coordinate,reference){
  model.update((coordinate-p.initialCyclePhase)*p.period);
  const evaluate=q=>{setSpin(b.gearA,q);model.root.updateMatrixWorld(true);return overlap().maximumArea;};
  let low=reference-.001,high=model.root.userData.kinematics.angleA;
  if(evaluate(low)<=1e-13||evaluate(high)>1e-13)return null;
  for(let i=0;i<35;i++){const middle=(low+high)/2;if(evaluate(middle)>1e-13)low=middle;else high=middle;}
  return high;
}
const moving=motion.rows.filter(r=>r.step>motion.steps*(motion.cycles-1)&&r.advance>1e-8&&r.contact),
  selected=moving.filter((r,i)=>i%8===0||i===moving.length-1||r.nominalAngle-r.angle<.002&&r.coordinate%1>.985),rows=[];
for(const sample of selected){
  const epsilon=1e-6,before=loadedAngle(sample.coordinate-epsilon,sample.angle),after=loadedAngle(sample.coordinate+epsilon,sample.angle);
  model.update((sample.coordinate-p.initialCyclePhase)*p.period);setSpin(b.gearA,sample.angle);model.root.updateMatrixWorld(true);
  const A=b.gearA.userData.toothMeshes.find(m=>m.userData.index===sample.contact.outputTooth),C=b.driverC.userData.toothMeshes.find(m=>m.userData.index===sample.contact.driverTooth),a=rings(A),c=rings(C);
  const contacts=[...vertexEdges(a,c,1),...vertexEdges(c,a,-1)],positive=contacts.filter(c=>c.outputTorque>1e-5&&c.ratio>=0).sort((a,b)=>Math.abs(a.distance)-Math.abs(b.distance));
  const exact=meshPairDistance(tree(C),tree(A),A.matrixWorld.clone().invert().multiply(C.matrixWorld),1e-4),contact=positive[0]??null;
  const numericalRatio=before===null||after===null?null:(after-before)/(2*epsilon*2*Math.PI);
  rows.push({coordinate:sample.coordinate,angle:sample.angle,outputTooth:A.userData.index,driverTooth:C.userData.index,
    skinDistance:exact.distance,testedTriangles:exact.testedTriangles,nearContacts:contacts.length,contact,numericalRatio,
    ratioError:contact&&numericalRatio!==null?contact.ratio-numericalRatio:null});
}
const issues=rows.filter(r=>!r.contact||r.skinDistance>1e-6||r.numericalRatio===null||Math.abs(r.ratioError)>.02);
const report={movement:74,status:'isolated-contact-force-audit',productionChanged:false,motionFile,rows,issues,
  maximumSkinDistance:Math.max(...rows.map(r=>r.skinDistance)),maximumRatioError:Math.max(...rows.map(r=>Math.abs(r.ratioError??Infinity))),
  minimumDrivingMoment:Math.min(...rows.map(r=>r.contact?.outputTorque??0)),
  qualification:'Actual ruled-flank normals at vertex/edge contact on a common material sphere, with positive output moment and opposing input reaction. The moment ratio is compared with independently bisected contact angles at input coordinates +/-1e-6; exact Float32 triangle distances independently check the reported tooth pair. For an ideal quasistatic bearing-friction load, a positive reaction balances the resisting output moment and equal input/output contact power follows from the moment ratio. No inertial acceleration or positive dwell lock is claimed. Other gear pairs and bodies require separate clearance verification.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-contact-forces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,issues:issues.length,maximumSkinDistance:report.maximumSkinDistance,maximumRatioError:report.maximumRatioError,minimumDrivingMoment:report.minimumDrivingMoment});
if(issues.length)process.exitCode=1;
