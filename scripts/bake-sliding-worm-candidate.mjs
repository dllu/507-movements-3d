import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {BufferGeometry} from 'three';
import {makeSlidingWormGeometry} from '../src/simulation/sliding-worm-geometry.js';
import {simplifyWormWheel} from './lib/simplify-worm-wheel.mjs';
const input='/dev/shm/143-refined-profile.json',profile=JSON.parse(fs.readFileSync(input)),model=makeSlidingWormGeometry(profile.profile);
try{
 const wheel=model.root.userData.parts.wheel,original=wheel.geometry;
 wheel.geometry=await simplifyWormWheel(original,profile.parameters,profile.profile);original.dispose();wheel.computeBoundingBox();wheel.computeBoundingSphere();
 const simplification=wheel.geometry.userData.simplification;
 fs.writeFileSync('/dev/shm/143-wheel-render.json',JSON.stringify(wheel.geometry.toJSON()));
 const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const bounds={min:[-4.1,-1.45,-.8],max:[3.8,1.85,.85]};
 const sources=[input,'src/simulation/sliding-worm-geometry.js','src/simulation/sliding-worm-kinematics.js','src/simulation/instanced-worm-wheel.js','src/simulation/bored-worm-geometry.js','src/simulation/worm-gear-geometry.js','src/simulation/finite-plate-geometry.js','scripts/bake-sliding-worm-candidate.mjs','scripts/lib/simplify-worm-wheel.mjs','scripts/lib/relieve-worm-wheel.mjs'].map(file=>({file,sha256:hash(file)}));
 model.root.traverse(o=>{o.userData={};if(o.geometry){const old=o.geometry;o.geometry=new BufferGeometry().copy(old);o.geometry.userData={};old.dispose();}});
 const bundle={bounds,sources,simplification,object:model.root.toJSON()},bytes=gzipSync(JSON.stringify(bundle),{level:9});
 fs.writeFileSync('/dev/shm/143-candidate.json.gz',bytes);fs.writeFileSync('/dev/shm/143-candidate.json',JSON.stringify(bundle));console.log({bytes:bytes.length,simplification});
}finally{model.dispose();}
