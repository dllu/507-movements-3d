import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=name=>JSON.parse(fs.readFileSync('artifacts/review/'+name+'.json')),
 freeze=read('078-verification-source-hashes'),inputs=read('080-baseline-inputs'),surface=read('080-baseline-surfaces'),manifest=read('080-baseline-captures');
for(const [file,sha]of Object.entries(freeze))if(hash(fs.readFileSync(file))!==sha)throw Error('Verified production changed: '+file);
const sources=[...inputs.sources,...surface.sources,...manifest.sources];
for(const s of sources)if(hash(fs.readFileSync(s.archive))!==s.sha256)throw Error('Archived source changed: '+s.archive);
const views=manifest.captures.map(c=>{
 if(hash(fs.readFileSync(c.file))!==c.sha256)throw Error('Capture changed: '+c.file);
 return{...c,inspected:true,accepted:false,qualification:'Viewed against the Brown engraving. Incorrect open-ended rack outline, excessive tooth count, short pawls, constant-width lever and extra base/post/guide hardware. All six views rejected as the final reconstruction.'};
});
const notes=`# Movement 080 reconstruction review\n\nThe original model is rejected. This is a baseline review; no replacement has been implemented.\n\nThe [official source](https://507movements.com/mm_080.html) describes vibrating lever C and two hooked pawls alternately lifting slotted rack A. The Brown page crop shows a finite closed slot, flared rack head, plain lower stem, tapered cross lever, long crossed pawls and rounded end weights. The current rack has 29 teeth per side extending above the lever, an open top, short pawls and extra visible supports. All six baseline captures have been inspected and rejected.\n\nAcross 193 poses and 720 independent pawl/rack pairs, 2,101,460 actual surface samples find 232,128 intrusions beyond 1e-6, with maximum depth 0.0543770058. The screen is one directional because the original torus hooks have uncapped ends; detected intrusion into the closed rack meshes is sufficient to reject the model. Four phase-seam checks also find a whole-rack jump of one pitch (0.2394244146) while the physical displacement is continuous.\n\nThe next reconstruction must measure the source geometry, retain finite rack travel, and resolve real three-dimensional hook/rack contact and pawl crossing clearance. No source dimensions or tooth count have yet been fitted. Movement 079 remains the active reconstruction, and 080 production code remains unchanged. See [baseline checkpoint](080-baseline-checkpoint.json), [surface findings](080-baseline-surfaces.json), and [capture manifest](080-baseline-captures.json).\n`;
fs.writeFileSync('artifacts/review/080-reconstruction-notes.md',notes,{flag:'wx'});
const files=fs.readdirSync('artifacts/review').filter(n=>n.startsWith('080-')&&!n.endsWith('.png')).map(n=>'artifacts/review/'+n);
files.push('scripts/record-crossed-rack-baseline.mjs','artifacts/reference/brown-080-detail.png');
const report={movement:80,status:'original-baseline-rejected',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 frozenInputsMatched:Object.keys(freeze).length,views,sourceCropInspected:true,sourceMeasurementsFitted:false,
 surface:{poses:surface.poses,pairs:surface.pairs.length,checks:surface.checks,penetrations:surface.penetrations,maximumDepth:surface.maximumDepth,failedPairs:surface.failedPairs.length,seams:surface.seams},
 remaining:['Measure engraving geometry','Rebuild finite rack, lever and hooked pawls','Resolve loaded contact and finite travel without whole-body modulo reset','Verify geometry, motion, rendering and integration'],
 files:files.map(file=>({file,sha256:hash(fs.readFileSync(file))})),full507GoalStillActive:true};
fs.writeFileSync('artifacts/review/080-baseline-checkpoint.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({status:report.status,views:views.length,files:report.files.length,frozenInputs:report.frozenInputsMatched});
