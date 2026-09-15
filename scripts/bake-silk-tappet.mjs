import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const nativeFile='/dev/shm/173-native-tappet.json';
const runs=JSON.parse(fs.readFileSync(nativeFile)),run=runs[1];
assert.equal(run.parameters.timestep,.000025);
const rows=run.samples.map((s,i)=>[i*.0005,s.carrier,s.wheel]);
const tolerance=5e-7,keep=new Set([0,rows.length-1]),stack=[[0,rows.length-1]];
while(stack.length){const [a,b]=stack.pop();let worst=tolerance,index=-1;
 for(let i=a+1;i<b;i++){const u=(i-a)/(b-a);const error=Math.max(...[1,2].map(j=>Math.abs(rows[i][j]-rows[a][j]-u*(rows[b][j]-rows[a][j]))));if(error>worst){worst=error;index=i;}}
 if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
}
const indices=[...keep].sort((a,b)=>a-b),motion=indices.map(i=>rows[i]);let maximumError=0;
for(let k=1;k<indices.length;k++)for(let i=indices[k-1];i<=indices[k];i++){
 const a=rows[indices[k-1]],b=rows[indices[k]],u=(rows[i][0]-a[0])/(b[0]-a[0]);
 for(const j of [1,2])maximumError=Math.max(maximumError,Math.abs(rows[i][j]-a[j]-u*(b[j]-a[j])));
}
assert.ok(maximumError<=tolerance+1e-10);
const sources=['scripts/bake-silk-tappet.mjs','scripts/qualify-silk-tappet.mjs','src/simulation/mujoco-silk-tappet/physics.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const bundle={version:1,movement:173,status:'baked-contact-motion',duration:72,parameters:run.parameters,motion,maximumError,
 nativeHash:createHash('sha256').update(fs.readFileSync(nativeFile)).digest('hex'),sources};
const bytes=gzipSync(JSON.stringify(bundle),{level:9});
fs.writeFileSync('src/simulation/baked/assets/173-tappet.json.gz',bytes);
fs.writeFileSync('docs/validation/173-tappet-bake.json',JSON.stringify({...bundle,motion:undefined,samples:motion.length,nativeSamples:rows.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');
console.log({keys:motion.length,bytes:bytes.length,maximumError});
