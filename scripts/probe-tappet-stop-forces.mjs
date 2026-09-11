import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeTappetStopCandidate} from './lib/tappet-stop-candidate.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {triangleTree,meshPairDistance} from './lib/star-mangle-pair-distance.mjs';
const m=makeTappetStopCandidate(),{parts,geometry:p}=m.root.userData;
const trees=Object.fromEntries(Object.entries(parts).map(([name,mesh])=>[name,triangleTree(new THREE.BufferGeometry().setFromPoints(surfaceTriangles(mesh.geometry).filter(t=>Math.abs(t.getNormal(new THREE.Vector3()).z)<.01).flatMap(t=>[t.a,t.b,t.c])))]));
const axis={input:new THREE.Vector3(0,0,0),output:new THREE.Vector3(p.D,0,0),stop:new THREE.Vector3(...p.pivot,0)};
const pair=(a,b,first,second,wa,wb)=>{
 const A=parts[a],B=parts[b],distance=meshPairDistance(trees[a],trees[b],B.matrixWorld.clone().invert().multiply(A.matrixWorld),.02);
 if(!distance.witness)throw Error(`No actual contact witness: ${a}/${b}`);
 const w=distance.witness,pa=new THREE.Vector3().fromArray(w.a).applyMatrix4(B.matrixWorld),pb=new THREE.Vector3().fromArray(w.b).applyMatrix4(B.matrixWorld);
 // Positive gaps provide an actual separating normal, including a tooth
 // vertex normal inside its cone. At touching/roundoff use the giver's face.
 const force=distance.distance>1e-9?pb.clone().sub(pa).normalize():new THREE.Vector3().fromArray(w.aNormal).transformDirection(B.matrixWorld);
 const torqueA=pa.clone().sub(axis[first]).cross(force.clone().negate()).z;
 const torqueB=pb.clone().sub(axis[second]).cross(force).z;
 const powerA=torqueA*wa,powerB=torqueB*wb;
 return{a,b,gap:distance.distance,pa:pa.toArray(),pb:pb.toArray(),force:force.toArray(),torqueA,torqueB,powerA,powerB,
  normalVelocityResidual:Math.abs(powerA+powerB),relativePowerResidual:Math.abs(powerA+powerB)/Math.max(Math.abs(powerA),Math.abs(powerB),1e-4)};
};
const rows=[],count=Number(process.env.PROBE_POSES??65),span=p.gammaStart-p.gammaEnd;
for(let i=0;i<count;i++){
 const phase=span*(i+.317)/count,time=(p.sourceGamma-p.gammaStart+phase)/p.inputSpeed;
 m.update(time);m.root.updateMatrixWorld(true);const state=m.root.userData.kinematics,h=1e-5;
 const before=m.root.userData.stateAtTime(time-h),after=m.root.userData.stateAtTime(time+h);
 const outputSpeed=(after.outputAngle-before.outputAngle)/(2*h),stopSpeed=(after.stopAngle-before.stopAngle)/(2*h);
 const tappet=pair('tappet','stud0','input','output',-p.inputSpeed,outputSpeed);
 const stud=pair('stopBody','stud2','stop','output',stopSpeed,outputSpeed);
 const cam=pair('driverDisk','stopToe','input','stop',-p.inputSpeed,stopSpeed);
 const studReaction=.25,tappetReaction=(1-stud.torqueB*studReaction)/tappet.torqueB,camReaction=-stud.torqueA*studReaction/cam.torqueB;
 rows.push({time,phase,stage:state.stage,outputSpeed,stopSpeed,tappet,stud,cam,reactions:{stud:studReaction,tappet:tappetReaction,cam:camReaction},
  outputTorqueResidual:tappet.torqueB*tappetReaction+stud.torqueB*studReaction-1,stopTorqueResidual:cam.torqueB*camReaction+stud.torqueA*studReaction});
 console.log({pose:i,stage:state.stage,gaps:[tappet.gap,stud.gap,cam.gap],maximumResidual:Math.max(tappet.normalVelocityResidual,stud.normalVelocityResidual,cam.normalVelocityResidual)});
}
const locks=[];
for(let cycle=0;cycle<10;cycle++){
 const time=(p.sourceGamma-p.gammaStart+1+cycle*Math.PI*2)/p.inputSpeed;m.update(time);m.root.updateMatrixWorld(true);
 const gaps=Array.from({length:10},(_,i)=>{const A=parts.stopBody,B=parts['stud'+i],hit=meshPairDistance(trees.stopBody,trees['stud'+i],B.matrixWorld.clone().invert().multiply(A.matrixWorld),.05);return{stud:i,gap:hit.distance};}).sort((a,b)=>a.gap-b.gap).slice(0,2);
 const contacts=gaps.map(g=>pair('stopBody','stud'+g.stud,'stop','output',0,0)),cam=pair('driverDisk','stopToe','input','stop',-p.inputSpeed,0);
 const constraints=[[0,cam.torqueB],...contacts.map(q=>[q.torqueB,q.torqueA])];
 let maximumMinimumClearanceVelocity=-Infinity;
 for(let j=0;j<7200;j++){const angle=2*Math.PI*j/7200,velocity=[Math.cos(angle),Math.sin(angle)],minimum=Math.min(...constraints.map(([a,b])=>a*velocity[0]+b*velocity[1]));maximumMinimumClearanceVelocity=Math.max(maximumMinimumClearanceVelocity,minimum);}
 locks.push({cycle,time,cam,contacts,constraints,maximumMinimumClearanceVelocity});
}
const all=rows.flatMap(r=>[r.tappet,r.stud,r.cam]),summary={poses:rows.length,lockPoses:locks.length,minimumGap:Math.min(...all.map(r=>r.gap)),maximumGap:Math.max(...all.map(r=>r.gap)),
 maximumNormalVelocityResidual:Math.max(...all.map(r=>r.normalVelocityResidual)),maximumRelativePowerResidual:Math.max(...all.map(r=>r.relativePowerResidual)),
 minimumTappetReaction:Math.min(...rows.map(r=>r.reactions.tappet)),minimumCamReaction:Math.min(...rows.map(r=>r.reactions.cam)),
 minimumCamMoment:Math.min(...rows.map(r=>r.cam.torqueB)),maximumStopStudMoment:Math.max(...rows.map(r=>r.stud.torqueA)),
 worstLockConeMargin:Math.max(...locks.map(r=>r.maximumMinimumClearanceVelocity)),maximumLockGap:Math.max(...locks.flatMap(r=>[r.cam,...r.contacts].map(q=>q.gap)))};
const files=['scripts/lib/tappet-stop-candidate.mjs','scripts/lib/tappet-stop-study.mjs','scripts/probe-tappet-stop-forces.mjs'];
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/065-candidate-forces.json',JSON.stringify({movement:65,status:'isolated-force-diagnostic',productionChanged:false,
 method:'Actual closest vertical triangle skins supply contact witnesses and separation normals (giver face normal at touching). Body speeds are independently differentiated from nearby poses. Unit-normal moment/power checks and a positive quasistatic unit resisting-output-torque equilibrium cover all three contacts. Dwell checks all ten index orientations, the two closest physical studs and cam, and 7200 directions in the two-coordinate velocity cone. Kinematics idealize the initial rigid strike; masses, compliance and impact forces are not simulated.',
 hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')]))),summary,rows,locks},null,2)+'\n');console.log(summary);
if(summary.maximumGap>1e-5||summary.maximumNormalVelocityResidual>.006||summary.minimumTappetReaction<=0||summary.minimumCamReaction<=0||summary.worstLockConeMargin>=-.1)process.exitCode=1;
