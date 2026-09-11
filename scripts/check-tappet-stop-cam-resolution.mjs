import{writeFile}from'node:fs/promises';
import{makeTappetStudStop}from'../src/simulation/tappet-stud-stop.js';
import{add,rotate,closestSegment,sub,norm,dot,unit}from'../src/simulation/tappet-stud-stop-contact.js';
const m=makeTappetStudStop(),{geometry:p,paths}=m.root.userData,cam=paths.cam.map(q=>q.map(Math.fround));
const center=gamma=>rotate(add(p.pivot,rotate(p.toeCenter,m.motion.stopAt(m.motion.motion(gamma).beta).theta)),-gamma);
let maxDistance=0,maxNormalAngle=0,minAngularStep=Infinity,previous=null;
const rows=[];
for(let i=0;i<8193;i++){
 const gamma=p.gammaStart+(p.gammaEnd-p.gammaStart)*(i+.317)/8193,q=center(gamma);
 let hit={distance:Infinity};for(let j=0;j<cam.length;j++){const candidate=closestSegment(q,cam[j],cam[(j+1)%cam.length]);if(candidate.distance<hit.distance)hit={...candidate,edge:j};}
 const edge=sub(cam[(hit.edge+1)%cam.length],cam[hit.edge]),normal=unit([edge[1],-edge[0]]),h=1e-6,derivative=sub(center(gamma+h),center(gamma-h)),expected=unit([-derivative[1],derivative[0]]);
 const angle=Math.acos(Math.max(-1,Math.min(1,dot(normal,expected))));maxDistance=Math.max(maxDistance,hit.distance);maxNormalAngle=Math.max(maxNormalAngle,angle);
 const phi=Math.atan2(q[1],q[0]);if(previous!==null)minAngularStep=Math.min(minAngularStep,phi-previous);previous=phi;
 if(i%128===0)rows.push({gamma,deviation:hit.distance,normalAngle:angle});
}
const report={movement:65,method:'8193 off-grid exact contact poses compare the finite toe corner with the actual Float32 cam polygon, exceeding twice the 4096-point generating density. Independently differenced continuous path tangents compare to rendered edge normals. This bounds sampled geometric error, not a global proof.',samples:8193,renderedOutlineVertices:cam.length,maxDistance,maxNormalAngleRadians:maxNormalAngle,minAngularStep,rows};
await writeFile('artifacts/review/065-cam-resolution.json',JSON.stringify(report,null,2)+'\n');console.log({maxDistance,maxNormalAngle,minAngularStep});if(maxDistance>1e-6||maxNormalAngle>.006||minAngularStep<=0)process.exitCode=1;
