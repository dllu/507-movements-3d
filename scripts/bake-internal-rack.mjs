import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {BufferGeometry,Box3,Vector3,Group} from 'three';
import {makeInternalRackGeometry} from '../src/simulation/mujoco-internal-rack/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const file=process.env.REPORT??'/dev/shm/139-native-long.json',r=JSON.parse(fs.readFileSync(file));
const profile=JSON.parse(fs.readFileSync('/dev/shm/139-generated-profile.json'));
assert.equal(r.resets,0);assert.equal(r.counterMass,8);assert.equal(r.timestep,.000125);assert.equal(r.contactTime,.001);assert(r.penetration*100<.05);
const period=r.period,cycle=Math.round(period/.01),{rows}=r;let best;
const weights=[.325,1,1,.585,.575];
for(let i=cycle+1;i+cycle+1<rows.length;i++){
 const end=i+cycle,a=rows[i],b=rows[end];
 const positionError=Math.max(...weights.map((w,k)=>Math.abs(b[k+1]-a[k+1]-(k===0?profile.rotationPerCycle:0))*w*100));
 const velocityError=Math.max(...weights.map((w,k)=>Math.abs(rows[end+1][k+1]-rows[end-1][k+1]-rows[i+1][k+1]+rows[i-1][k+1])/.02*w*100));
 const score=Math.max(positionError,velocityError*.1);
 if(!best||score<best.score)best={i,end,score,positionError,velocityError};
}
assert(best&&best.positionError<.05&&best.velocityError<.5,JSON.stringify(best));
const v=makeInternalRackGeometry(profile),{blocks}=v.root.userData,bounds=new Box3();
try{
 for(let i=0;i<=best.end;i+=2){v.sync(rows[i].slice(1));bounds.union(new Box3().setFromObject(v.root));}bounds.expandByScalar(.06);
 const assumptions=v.root.userData.massAssumptions;
 v.sync([0,0,0,0,0]);
 const couplerX=new Group();blocks.frame.add(couplerX);couplerX.add(blocks.coupler);blocks.coupler.position.set(0,0,0);blocks.couplerX=couplerX;
 const names=['pinion','frame','rack','leftCrank','rightCrank','leftRod','rightRod','couplerX','coupler','roller0','roller1'];
 names.forEach(n=>blocks[n].name='body:'+n);
 const motion=rows.slice(0,best.end+1).map(([t,a,x,y,c,r])=>[Number(t.toFixed(6)),a,x,y,c,c,r,r,-1.60-.075*Math.cos(c)-.58*Math.sin(c),1.01-.075*Math.sin(c)+.58*Math.cos(c),-x/.23,-x/.23]);
 v.root.traverse(o=>{o.userData={};if(o.geometry){const g=new BufferGeometry().copy(o.geometry);g.userData={};o.geometry.dispose();o.geometry=g;}});v.root.updateMatrixWorld(true);
 const sourceFiles=['scripts/probe-internal-rack.mjs','scripts/bake-internal-rack.mjs','src/simulation/mujoco-internal-rack/geometry.js','src/simulation/mujoco-internal-rack/profile.js','src/data/internal-rack-dimensions.js','src/simulation/mujoco/simulation.js'];
 const metadata={version:1,names,period,loopStart:motion[best.i][0],loopEnd:motion.at(-1)[0],turns:names.map((_,i)=>i===0?profile.rotationPerCycle:0),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new Vector3()).toArray(),cameraDirection:[.10,.05,15],source:{reportSha256:hash(file),sources:sourceFiles.map(file=>({file,sha256:hash(file)})),metersPerWorldUnit:.1,maximumLoopSeamPixels:best.positionError,maximumLoopVelocitySeamPixelsPerSecond:best.velocityError,maximumPenetrationPixels:r.penetration*100,assumptions,physics:'Passive rack and suspension with assumed lumped masses/inertias; horizontal coupler reduced to a top-pin point mass. Geometry panel masses illustrate feasibility, not an exact inertia match. Only the input pinion is driven.'}};
 const output='src/simulation/baked/assets/139.json.gz';fs.writeFileSync(output,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));
 fs.writeFileSync('src/simulation/baked/assets/139.provenance.json',JSON.stringify({...metadata,samples:motion.length,bytes:fs.statSync(output).size,assetSha256:hash(output)},null,2)+'\n');
 console.log({output,bytes:fs.statSync(output).size,best});
}finally{disposeObject3D(v.root);}
