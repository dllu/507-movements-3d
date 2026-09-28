import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {BufferGeometry,Box3,Vector3} from 'three';
import {makeExpansionEccentricGeometry} from '../src/simulation/mujoco-expansion-eccentric/geometry.js';
import {expansionEccentricProfile,expansionEccentricSpread} from '../src/simulation/expansion-eccentric-profile.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const file=process.env.REPORT??'/dev/shm/137-fine.json',r=JSON.parse(fs.readFileSync(file));
for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);
assert.equal(r.resets,0);assert(r.penetration<.001);
assert.deepEqual(r.options,{timestep:.00025,period:8,spread:expansionEccentricSpread,samples:384});
const period=8,cycle=4000,dt=.002;
// Pass 97: bake one steady-state cycle only. The recording's first seconds
// (cam spinning up, lower roller not yet turning) are not played back.
// Brown's lower roller has 0.06..1.33 px of play below the cam while the upper
// roller bears on it, so in the simulation it hardly ever touches the cam and
// stays still. It is rolled kinematically instead: its angle is integrated
// from the no-slip condition against the cam point nearest it. The upper
// roller keeps its simulated spin, and the same integration applied to it
// measures the simulation's slip (reported below).
const profile=expansionEccentricProfile(r.options.samples),scale=.01,forkPivot=[3.67,-.04];
const rollerAt={upper:[-3.67,1.10+r.options.spread*scale,.31],lower:[-3.69,-1.02-r.options.spread*scale,.32]};
const rollerState=(row,[x,y])=>{
 const cf=Math.cos(row[2]),sf=Math.sin(row[2]),c=[forkPivot[0]+cf*x-sf*y,forkPivot[1]+sf*x+cf*y];
 const cc=Math.cos(row[1]),sc=Math.sin(row[1]);let best=null;
 for(let j=0;j<profile.length;j++){
  const a=profile[j],b=profile[(j+1)%profile.length],ax=(cc*a[0]-sc*a[1])*scale,ay=(sc*a[0]+cc*a[1])*scale,bx=(cc*b[0]-sc*b[1])*scale,by=(sc*b[0]+cc*b[1])*scale;
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((c[0]-ax)*dx+(c[1]-ay)*dy)/(dx*dx+dy*dy))),px=ax+t*dx,py=ay+t*dy,d=Math.hypot(px-c[0],py-c[1]);
  if(!best||d<best.d)best={d,p:[px,py]};
 }
 return {c,p:best.p,gap:best.d};
};
// Absolute roller spin rate from no slip at P: v_c + w_r x (P - c) = w_cam x P.
const rollingRates=(i,[x,y,radius])=>{
 const a=rows[i-1],b=rows[i+1],m=rollerState(rows[i],[x,y]),ca=rollerState(a,[x,y]).c,cb=rollerState(b,[x,y]).c;
 const wc=(b[1]-a[1])/(2*dt),wf=(b[2]-a[2])/(2*dt),vc=[(cb[0]-ca[0])/(2*dt),(cb[1]-ca[1])/(2*dt)];
 const n=[(m.p[0]-m.c[0])/m.gap,(m.p[1]-m.c[1])/m.gap],perp=[-n[1],n[0]],surface=[-wc*m.p[1],wc*m.p[0]];
 const absolute=((surface[0]-vc[0])*perp[0]+(surface[1]-vc[1])*perp[1])/radius;
 return {relative:absolute-wf,gap:m.gap-radius};
};
const {rows}=r;let best;
for(let i=8001;i+cycle+1<rows.length;i++){
 const end=i+cycle,a=rows[i],b=rows[end];
 const positionError=Math.max(Math.abs(b[1]-a[1]-2*Math.PI)*95,Math.abs(b[2]-a[2])*400,Math.abs(b[5]-a[5])*185);
 const velocityError=Math.max(...[1,2,3,5].map((k,j)=>Math.abs((rows[end+1][k]-rows[end-1][k]-rows[i+1][k]+rows[i-1][k])/.004)*[95,400,31,185][j]));
 // Start the loop as near the engraved pose (cam angle 0 mod a turn) as the
 // seam allows.
 const phase=Math.abs(Math.atan2(Math.sin(a[1]),Math.cos(a[1])));
 const score=Math.max(positionError,velocityError*.1)+phase*95;
 if(!best||score<best.score)best={i,end,score,positionError,velocityError,startPhase:phase};
}
assert(best&&best.positionError<.05&&best.velocityError<.5,JSON.stringify(best));
const turnsOffset=2*Math.PI*Math.round(rows[best.i][1]/(2*Math.PI));
const lowerAngles=[0];let maximumUpperSlip=0,minimumLowerGap=Infinity,maximumLowerGap=-Infinity,upperTurns=0;
for(let i=best.i;i<best.end;i++){
 const l0=rollingRates(i,rollerAt.lower),l1=rollingRates(i+1,rollerAt.lower);lowerAngles.push(lowerAngles.at(-1)+(l0.relative+l1.relative)/2*dt);
 minimumLowerGap=Math.min(minimumLowerGap,l0.gap);maximumLowerGap=Math.max(maximumLowerGap,l0.gap);
 const u=rollingRates(i,rollerAt.upper),simulated=(rows[i+1][3]-rows[i-1][3])/(2*dt);
 maximumUpperSlip=Math.max(maximumUpperSlip,Math.abs(simulated-u.relative)*31);upperTurns+=u.relative*dt;
}
const lowerStart=rows[best.i][4]-2*Math.PI*Math.floor(rows[best.i][4]/(2*Math.PI));
const upperStart=rows[best.i][3]-2*Math.PI*Math.floor(rows[best.i][3]/(2*Math.PI));
const steady=rows.slice(best.i,best.end+1).map((row,k)=>[row[0]-rows[best.i][0],row[1]-turnsOffset,row[2],row[3]-rows[best.i][3]+upperStart,lowerStart+lowerAngles[k],row[5]]);
const kinematic={lowerRoller:'no-slip rolling on the nearest cam point',minimumLowerGapPixels:minimumLowerGap*100,maximumLowerGapPixels:maximumLowerGap*100,maximumUpperSimulatedSlipPixelsPerSecond:maximumUpperSlip,upperSimulatedTurns:steady.at(-1)[3]-steady[0][3],upperNoSlipTurns:upperTurns};
console.log(kinematic);
const v=makeExpansionEccentricGeometry(r.options);
try{
 const names=['cam','fork','upper','lower','rod'],blocks=v.root.userData.blocks;
 const bounds=new Box3();
 for(let i=0;i<steady.length;i+=10){names.forEach((n,k)=>blocks[n].rotation.z=steady[i][k+1]);v.root.updateMatrixWorld(true);bounds.union(new Box3().setFromObject(v.root));}
 bounds.expandByScalar(.06);names.forEach(n=>{blocks[n].rotation.z=0;blocks[n].name='body:'+n;});
 v.root.traverse(o=>{o.userData={};if(o.geometry){const g=new BufferGeometry().copy(o.geometry);g.userData={};o.geometry.dispose();o.geometry=g;}});v.root.updateMatrixWorld(true);
 const motion=steady.map(row=>[Number(row[0].toFixed(6)),...row.slice(1)]);
 const turns=[2*Math.PI,0,motion.at(-1)[3]-motion[0][3],motion.at(-1)[4]-motion[0][4],0];
 const metadata={version:1,names,period,loopStart:0,loopEnd:motion.at(-1)[0],turns,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new Vector3()).toArray(),cameraDirection:[.12,.08,15],source:{reportSha256:hash(file),simulationSources:r.sources,geometrySources:['src/simulation/mujoco-expansion-eccentric/geometry.js','scripts/bake-expansion-eccentric.mjs'].map(file=>({file,sha256:hash(file)})),options:r.options,maximumLoopSeamPixels:best.positionError,maximumLoopVelocitySeamPixelsPerSecond:best.velocityError,maximumPenetrationPixels:r.penetration*100,steadyStateStart:rows[best.i][0],kinematic}};
 const output='src/simulation/baked/assets/137.json.gz';fs.writeFileSync(output,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));
 const result={...metadata,samples:motion.length,bytes:fs.statSync(output).size,assetSha256:hash(output)};fs.writeFileSync('src/simulation/baked/assets/137.provenance.json',JSON.stringify(result,null,2)+'\n');console.log({output,samples:motion.length,bytes:result.bytes,best});
}finally{disposeObject3D(v.root);}
