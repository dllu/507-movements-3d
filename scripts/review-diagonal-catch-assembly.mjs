import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeBakedDiagonalCatchModel} from '../src/simulation/baked/diagonal-catch.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

const asset='src/simulation/baked/assets/181.json.gz',bundle=JSON.parse(gunzipSync(fs.readFileSync(asset)));
const model=makeBakedDiagonalCatchModel(bundle),u=model.root.userData;
const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>[a,b]));
const intersections={};let queries=0;
try{
 for(let i=0;i<=128;i++){
  const time=bundle.period*i/128;model.update(time);
  for(const p of parts){assert.ok(p.mesh.matrixWorld.elements.every(Number.isFinite));p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const[a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
   for(const[from,to]of[[a,b],[b,a]]){const matrix=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){queries++;const q=sample.clone().applyMatrix4(matrix);if(!to.surface.inside(q))continue;const depth=to.surface.distance(q);
     if(depth>1e-6){const key=a.name+'/'+b.name;if(depth>(intersections[key]?.depth??0))intersections[key]={depth,time};}
    }
   }
  }
 }
 const sources=['scripts/review-diagonal-catch-assembly.mjs',asset,'src/simulation/baked/diagonal-catch.js',
  'src/simulation/baked/playback.js','src/simulation/mujoco-diagonal-catch/update-solids.js','tests/helpers/solid-surface.mjs'];
 const report={movements:[181,182],poses:129,meshes:parts.length,pairs:pairs.length,queries,intersections,
  method:'Every cross-family pair in the serialized visible assembly (single-plane castings, no finger supports or axial webs). Bidirectional vertices, edge midpoints and face centers. Both variants share this full cycle. Sampled evidence, not continuous proof.',
  sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/181-baked-assembly-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 assert.ok(queries>0);assert.equal(Object.keys(intersections).length,0);
}finally{model.dispose();}
