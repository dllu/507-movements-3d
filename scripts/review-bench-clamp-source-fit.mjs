import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {makeBakedBenchClampModel} from '../src/simulation/baked/bench-clamp.js';
const asset='src/simulation/baked/assets/174.json.gz',m=makeBakedBenchClampModel(JSON.parse(gunzipSync(fs.readFileSync(asset))));
try{
 const references=[['upper crest','jaw0',[318,112]],['upper inner hook','jaw0',[366,190]],['upper nose','jaw0',[408,234]],['lower inner hook','jaw1',[366,325]],['lower crest','jaw1',[302,411]],['lower nose','jaw1',[408,294]]];
 const features=references.map(([name,part,source])=>{
  const mesh=m.root.userData.parts[part],p=mesh.geometry.attributes.position;let errorPixels=Infinity,projected;
  for(let i=0;i<p.count;i++){const v=mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)),q=[123+v.x/.012,264-v.y/.012],d=Math.hypot(q[0]-source[0],q[1]-source[1]);if(d<errorPixels){errorPixels=d;projected=q;}}
  return {name,source,projected,errorPixels};
 });
 const report={movement:174,status:'lower-jaw-source-fit-open',features,
 method:'Nearest projected jaw mesh vertex to selected manually measured engraving boundary points. These are sparse feature checks, not a whole-contour registration.',
 sources:['scripts/review-bench-clamp-source-fit.mjs','src/simulation/baked/bench-clamp.js',asset,'public/engravings/mm_174.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/174-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(features);
}finally{m.dispose();}
