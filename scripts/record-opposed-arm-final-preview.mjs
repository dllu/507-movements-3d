import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),file='artifacts/review/079-loop-preview-browser.json',
 manifest=JSON.parse(fs.readFileSync(file)),profile='artifacts/review/079-projected-finest-candidate.json';
if(manifest.errors.length||manifest.captures.length!==10)throw Error('Incomplete preview');
const views=manifest.captures.map(c=>{
 if(hash(fs.readFileSync(c.file))!==c.sha256)throw Error('Changed capture: '+c.file);
 return{...c,inspected:true,visualAccepted:true,mechanicsPassed:false,qualification:c.name==='source-overlay'?
  'Viewed at identical engraving scale/origin: the wheel circles, joint centers, radial arms, connecting rods and pawl silhouettes align closely. Regularized tooth pitch differs from irregular engraved divisions.':
  c.name==='source-aligned'?'Viewed: orthographic camera matches the source crop and object-fit letterboxing. This is a source-comparison pose, separate from the whole-stroke display camera.':
  'Viewed: complete, readable mechanism with no ground, fog or scene clipping. Layered hubs cast real shadows; the dark rear is the solid back of the face ratchet. Desktop and mobile presentation accepted.'};
});
const sources=[file,profile,'scripts/record-opposed-arm-final-preview.mjs'].map(file=>({file,sha256:hash(fs.readFileSync(file))}));
fs.writeFileSync('artifacts/review/079-final-preview-inspections.json',JSON.stringify({movement:79,status:'bounded-playback-preview-inspected',created:new Date().toISOString(),
 productionChanged:false,mechanicsPassed:false,views,sources,videoRecorded:false,videoWatched:false,
 reconstructionAssumptions:'Axial dimensions, concealed radial journals, ideal torsional preload, common material density, prescribed horizontal slider stroke and output resistance are reconstructed. The preload is represented as an ideal hinge torque; no detailed spring coil is modeled.'},null,2)+'\n',{flag:'wx'});
console.log({views:views.length,productionChanged:false});
