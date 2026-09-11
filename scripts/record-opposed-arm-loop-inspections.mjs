import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),manifests=['079-loop-prototype-browser','079-shadow-study','079-shadow-refresh'],views=[];
for(const name of manifests){
 const file='artifacts/review/'+name+'.json',r=JSON.parse(fs.readFileSync(file));
 for(const c of r.captures){
  if(hash(fs.readFileSync(c.file))!==c.sha256)throw Error('Capture changed: '+c.file);
  views.push({...c,manifest:file,inspected:true,acceptedForProduction:false,qualification:name==='079-loop-prototype-browser'?
   'Viewed: readable mechanism and source, complete desktop/mobile framing, useful front/oblique/rear presentation. Uses the rejected .0005 interpolation and is only a UI prototype.':
   name==='079-shadow-study'?'Viewed: first shadow comparison is diagnostic only; disabling shadowMap without refreshing material shader state did not provide a valid unshadowed control.':
   'Viewed: refreshed unshadowed controls remove the hub crescents and tooth shadows. The marks are cast shadows from stacked hubs/shaft cap; retain the original lighting, with no geometry or lighting change adopted.'});
 }
}
const files=[...manifests.map(n=>'artifacts/review/'+n+'.json'),'scripts/record-opposed-arm-loop-inspections.mjs'];
fs.writeFileSync('artifacts/review/079-loop-study-inspections.json',JSON.stringify({movement:79,productionChanged:false,mechanicsPassed:false,
 created:new Date().toISOString(),views,files:files.map(file=>({file,sha256:hash(fs.readFileSync(file))})),videoRecorded:false,videoWatched:false},null,2)+'\n',{flag:'wx'});
console.log({inspected:views.length});
