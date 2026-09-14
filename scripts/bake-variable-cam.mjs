import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {BufferGeometry,Box3,Vector3} from 'three';
import {makeVariableCamGeometry} from '../src/simulation/mujoco-variable-cam/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const file=process.env.REPORT??'/dev/shm/138-fine.json',r=JSON.parse(fs.readFileSync(file));
for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);
assert.equal(r.resets,0);assert(r.penetration<.002);assert.deepEqual(r.options,{timestep:.00025,period:8,samplesPerArc:128});
const {rows}=r,period=8,cycle=4000;let best;
for(let i=4001;i+cycle+1<rows.length;i++){
 const end=i+cycle,a=rows[i],b=rows[end];
 const positionError=Math.max(Math.abs(b[1]-a[1]+2*Math.PI)*123,Math.abs(b[2]-a[2])*51.25);
 const velocityError=Math.max(...[1,2].map((k,j)=>Math.abs((rows[end+1][k]-rows[end-1][k]-rows[i+1][k]+rows[i-1][k])/.004)*[123,51.25][j]));
 const score=Math.max(positionError,velocityError*.1);
 if(!best||score<best.score)best={i,end,score,positionError,velocityError};
}
assert(best&&best.positionError<.05&&best.velocityError<.5,JSON.stringify(best));
const v=makeVariableCamGeometry(r.options);
try{
 const names=['cam','follower'],blocks=v.root.userData.blocks,bounds=new Box3();
 for(let i=0;i<=best.end;i+=5){blocks.cam.rotation.z=rows[i][1];blocks.follower.position.y=-.45+rows[i][2];v.root.updateMatrixWorld(true);bounds.union(new Box3().setFromObject(v.root));}
 bounds.expandByScalar(.06);blocks.cam.rotation.z=0;blocks.follower.position.y=-.45;names.forEach(n=>blocks[n].name='body:'+n);
 v.root.traverse(o=>{o.userData={};if(o.geometry){const g=new BufferGeometry().copy(o.geometry);g.userData={};o.geometry.dispose();o.geometry=g;}});v.root.updateMatrixWorld(true);
 const motion=rows.slice(0,best.end+1).map(row=>[Number(row[0].toFixed(6)),...row.slice(1)]);
 const metadata={version:1,names,period,loopStart:motion[best.i][0],loopEnd:motion.at(-1)[0],turns:[-2*Math.PI,0],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new Vector3()).toArray(),cameraDirection:[.10,.05,15],source:{reportSha256:hash(file),simulationSources:r.sources,geometrySources:['src/simulation/authored-cams.js','src/simulation/mujoco-variable-cam/geometry.js','scripts/bake-variable-cam.mjs'].map(file=>({file,sha256:hash(file)})),options:r.options,metersPerWorldUnit:.05125,maximumLoopSeamPixels:best.positionError,maximumLoopVelocitySeamPixelsPerSecond:best.velocityError,maximumPenetrationPixels:r.penetration*51.25}};
 const output='src/simulation/baked/assets/138.json.gz';fs.writeFileSync(output,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));
 const result={...metadata,samples:motion.length,bytes:fs.statSync(output).size,assetSha256:hash(output)};fs.writeFileSync('src/simulation/baked/assets/138.provenance.json',JSON.stringify(result,null,2)+'\n');console.log({output,samples:motion.length,bytes:result.bytes,best});
}finally{disposeObject3D(v.root);}
