import fs from 'node:fs';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {makeSingleClampSolids} from '../src/simulation/mujoco-single-clamp/solids.js';
const qualification=JSON.parse(fs.readFileSync('docs/validation/180-native-cycle.json'));assert.equal(qualification.status,'native-cycle-checked');for(const source of qualification.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256);
const nativeFile='/dev/shm/180-native-cycles.json',run=JSON.parse(fs.readFileSync(nativeFile))[1],names=['jaw','boardX','boardY'];
assert.equal(run.parameters.timestep,.0000625);for(const value of Object.values(run.seam))assert.ok(value<.001);
const rows=run.samples.slice(8000,11001).map((s,i)=>[i*.002,...names.map(n=>s[n])]);
const keep=new Set([0,3000]),stack=[[0,3000]],tolerance=5e-6;
while(stack.length){const[a,b]=stack.pop();let error=tolerance,index=-1;for(let i=a+1;i<b;i++){const u=(i-a)/(b-a);const e=Math.max(...names.map((_,j)=>Math.abs(rows[i][j+1]-rows[a][j+1]-u*(rows[b][j+1]-rows[a][j+1]))));if(e>error){error=e;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}
const indices=[...keep].sort((a,b)=>a-b),motion=indices.map(i=>rows[i]);let maximumError=0;
for(let k=1;k<indices.length;k++)for(let i=indices[k-1];i<=indices[k];i++){const a=rows[indices[k-1]],b=rows[indices[k]],u=(rows[i][0]-a[0])/(b[0]-a[0]);for(let j=1;j<=3;j++)maximumError=Math.max(maximumError,Math.abs(rows[i][j]-a[j]-u*(b[j]-a[j])));}
assert.ok(maximumError<tolerance+1e-10);motion[motion.length-1]=[6,...motion[0].slice(1)];
// Include the verified microscopic native seam in the actual playback error.
for(let k=1;k<indices.length;k++)for(let i=indices[k-1];i<=indices[k];i++){const a=motion[k-1],b=motion[k],u=(rows[i][0]-a[0])/(b[0]-a[0]);for(let j=1;j<=3;j++)maximumError=Math.max(maximumError,Math.abs(rows[i][j]-a[j]-u*(b[j]-a[j])));}
assert.ok(maximumError<1e-5);
const v=makeSingleClampSolids();try{
 const bounds=new THREE.Box3();for(const r of rows){v.update(Object.fromEntries(names.map((n,i)=>[n,r[i+1]])));bounds.union(new THREE.Box3().setFromObject(v.root));}
 v.update(Object.fromEntries(names.map((n,i)=>[n,rows[0][i+1]])));v.root.traverse(o=>{o.userData={};});bounds.expandByScalar(.06);
 const sources=['scripts/bake-single-clamp.mjs','scripts/qualify-single-clamp-cycle.mjs','src/simulation/mujoco-single-clamp/physics.js','src/simulation/mujoco-single-clamp/profile.js','src/simulation/mujoco-single-clamp/solids.js','src/simulation/mujoco-single-clamp/update-solids.js','src/simulation/finite-plate-geometry.js','src/simulation/authored-clamps.js','src/simulation/mujoco-bench-clamp/profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const bundle={version:1,movement:180,object:v.root.toJSON(),motion,names,period:6,loopStart:0,loopEnd:6,turns:[0,0,0],maximumError,
 bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),sources,nativeHash:createHash('sha256').update(fs.readFileSync(nativeFile)).digest('hex'),
 assumptions:'Passive jaw hinge and free board X against a fixed side; orientation held and Y push/withdrawal supplied by a force-limited drive. Inferred masses, resistance, planar guidance and bearing depths. Unillustrated bench supports are sectioned away.'};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9});fs.writeFileSync('src/simulation/baked/assets/180.json.gz',bytes);
 fs.writeFileSync('docs/validation/180-bake.json',JSON.stringify({...bundle,object:undefined,motion:undefined,samples:motion.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');console.log({samples:motion.length,bytes:bytes.length,maximumError});
}finally{v.dispose();}
