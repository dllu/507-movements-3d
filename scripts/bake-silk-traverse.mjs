import fs from 'node:fs';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {BufferGeometry} from 'three';
import {makeSilkTraverseGeometry} from '../src/simulation/silk-traverse-geometry.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const v=makeSilkTraverseGeometry();
try{
 const metadata={version:1,bounds:{min:[-2.25,-7.4,-.5],max:[2.25,2.2,.95]},guide:v.root.userData.guide,assumptions:v.root.userData.assumptions,sources:['src/data/silk-traverse-dimensions.js','src/simulation/silk-traverse-gears.js','src/simulation/coaxial-gear-geometry.js','src/simulation/silk-traverse-geometry.js','src/simulation/silk-traverse-kinematics.js','scripts/bake-silk-traverse.mjs'].map(file=>({file,sha256:hash(file)}))};
 v.root.traverse(o=>{o.userData={};if(o.geometry){const old=o.geometry;o.geometry=new BufferGeometry().copy(old);o.geometry.userData={};old.dispose();}});
 const output='src/simulation/baked/assets/142.json.gz';fs.writeFileSync(output,gzipSync(JSON.stringify({...metadata,object:v.root.toJSON()}),{level:9}));
 fs.writeFileSync('src/simulation/baked/assets/142.provenance.json',JSON.stringify({...metadata,bytes:fs.statSync(output).size,assetSha256:hash(output)},null,2)+'\n');console.log({output,bytes:fs.statSync(output).size});
}finally{v.dispose();}
