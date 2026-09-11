import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),views=[];
for(const name of ['081-first-candidate','081-fitted-loaded']){
 const input=base+name+'-captures.json',report=JSON.parse(fs.readFileSync(input));assert.equal(report.errors.length,0);
 for(const c of report.captures){assert.equal(hash(c.file),c.sha256);
  const first=name==='081-first-candidate',detail=c.view.includes('detail');
  views.push({...c,inspected:true,visualAccepted:!first,
   qualification:first?(detail?'Viewed; excessive detail zoom crops the relevant assembly. Retained as a diagnostic.':'Viewed beside Brown; overall dimensions are close, but this trial precedes compatible tooth phase and is rejected as final geometry.'):
    'Viewed beside Brown. Source silhouette, seven rack teeth, six wheel teeth, real guide passages, closed constant-section coil and front/oblique/rear loaded poses are visually acceptable for this isolated candidate. The lower guide is vacated at high lift; the concealed fixed mandrel and rear slot continue guiding the hollow rack. Their continuous engagement and complete mechanics still require verification.'});
 }
}
const file='scripts/record-spring-rack-candidate-inspections.mjs',archive=base+'081-candidate-inspections-source.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
const report={movement:81,status:'isolated-candidate-view-inspections',productionChanged:false,mechanicsPassed:false,views,
 inspected:views.length,accepted:views.filter(v=>v.visualAccepted).length,source:{file,archive,sha256:hash(file)},
 qualification:'All 28 listed images were individually opened and inspected. This records static visual review, not a timed-motion or continuous-clearance pass.'};
fs.writeFileSync(base+'081-candidate-inspections.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({inspected:report.inspected,accepted:report.accepted});
