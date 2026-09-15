import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {createDiagonalCatchAssembly} from '../src/simulation/mujoco-diagonal-catch/assembly.js';

const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report=JSON.parse(fs.readFileSync('docs/validation/181-projected-contact-motion.json'));
assert.ok(Object.values(report.controls).every(Boolean));
for(const source of report.sources)assert.equal(hash(source.file),source.sha256,source.file);
const input='/dev/shm/181-contact-motion.json',motion=JSON.parse(fs.readFileSync(input)),model=createDiagonalCatchAssembly();
try{
 const bounds=new THREE.Box3();
 for(let i=0;i<motion.keys.length;i+=10){model.update(motion.keys[i].slice(1));bounds.union(new THREE.Box3().setFromObject(model.root));}
 bounds.expandByScalar(.06);model.update(motion.keys[0].slice(1));
 model.root.traverse(o=>{o.userData={};});
 const sources=['scripts/bake-diagonal-catch.mjs','src/simulation/mujoco-diagonal-catch/assembly.js',
  'src/simulation/mujoco-diagonal-catch/update-solids.js','src/simulation/mujoco-diagonal-catch/catch-profile.js',
  'src/simulation/authored-diagonal-catches.js','src/simulation/finite-plate-geometry.js','docs/validation/181-projected-contact-motion.json']
  .map(file=>({file,sha256:hash(file)}));
 const bundle={version:1,movements:[181,182],object:model.root.toJSON(),names:motion.names,motion:motion.keys,
  period:motion.period,loopStart:0,loopEnd:motion.period,turns:[0,0,0,0],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  focus:bounds.getCenter(new THREE.Vector3()).toArray(),inputHash:hash(input),sources};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9}),asset='src/simulation/baked/assets/181.json.gz';fs.writeFileSync(asset,bytes);
 fs.writeFileSync('docs/validation/181-bake.json',JSON.stringify({...bundle,object:undefined,motion:undefined,keys:motion.keys.length,
  bytes:bytes.length,sha256:hash(asset),status:'baked-assembly-source-review-open'},null,2)+'\n');
 console.log({keys:motion.keys.length,bytes:bytes.length});
}finally{model.dispose();}
