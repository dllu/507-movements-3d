import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeBakedSingleClampModel} from '../src/simulation/baked/single-clamp.js';
const m=makeBakedSingleClampModel(JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/180.json.gz'))));
try{
 m.update(0);const meshes=m.root.userData.parts;
 const features=[['upper outer tip','jaw',[250,62]],['upper outer arc','jaw',[294,91.5]],['upper shoulder','jaw',[316,111]],['outer cheek','jaw',[416,333]],['lower nose','jaw',[330,499]],['inner hook','jaw',[329,398]],['board contact lobe','jaw',[280,452]],['upper inner edge','jaw',[309,232]],['fixed upper left','fixed-side',[160,10]],['fixed upper right','fixed-side',[226,10]],['board upper right','board',[280,154]]].map(([name,part,target])=>{
  const mesh=meshes[part],p=mesh.geometry.attributes.position;let error=Infinity,nearest=null;
  for(let i=0;i<p.count;i++){const v=mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)),point=[280+v.x/.012,452-v.y/.012],d=Math.hypot(point[0]-target[0],point[1]-target[1]);if(d<error){error=d;nearest=point;}}
  return {name,part,target,nearest,errorPixels:error};
 });
 const maximumErrorPixels=Math.max(...features.map(f=>f.errorPixels));
 const report={movement:180,status:maximumErrorPixels<6?'selected-source-features-checked':'source-fit-open',method:'Nearest actual rendered vertices in initial front projection to eleven manually selected engraving features. Sparse feature check, not full contour registration.',maximumErrorPixels,features,sources:['scripts/review-single-clamp-source.mjs','src/simulation/baked/single-clamp.js','src/simulation/baked/assets/180.json.gz','public/engravings/mm_180.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/180-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(maximumErrorPixels<6);
}finally{m.dispose();}
