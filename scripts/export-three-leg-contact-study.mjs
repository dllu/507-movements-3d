// Offline diagnostic input only. Never imported by the viewer.
import fs from 'node:fs';
import {createAuthoredThreeLeggedEscapementMovement as create} from '../src/simulation/authored-three-legged-escapements.js';
const output=process.argv[2];
if(!output)throw new Error('Usage: node scripts/export-three-leg-contact-study.mjs /dev/shm/three-leg-input.json');
const all={};
for(const id of[306,307]){
 const model=create({id}),d=model.root.userData;
 all[id]={g:d.geometry,poses:Array.from({length:1025},(_,i)=>({t:4*i/1024,...d.stateAtTime(4*i/1024)}))};
 if(id===306){const geometry=d.blocks.legMeshes[0].geometry,p=geometry.attributes.position,index=geometry.index;
  all[id].legTriangles=Array.from({length:(index?.count??p.count)/3},(_,i)=>[0,1,2].map(j=>{const k=index?index.getX(3*i+j):3*i+j;return[p.getX(k),p.getY(k)];}));
 }
}
fs.writeFileSync(output,JSON.stringify(all));
