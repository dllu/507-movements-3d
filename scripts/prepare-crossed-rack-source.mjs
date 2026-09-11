import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='artifacts/review/',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 file=base+'080-source-measurements.json',r=JSON.parse(fs.readFileSync(file));
for(const s of r.sources)assert.equal(hash(s.archive),s.sha256);
assert.equal(hash(r.image.file),r.image.sha256);
const observations=[
 'Viewed the full annotated Brown crop. Both weight circles and both pawl bore fits follow the visible strokes closely. The fulcrum center follows its enclosed light opening; its radius is an inner-edge measurement.',
 'Sixteen teeth on each side follow the visible ordered sequence. Twenty-five usable driving strokes determine the shared pitch; seven covered or ambiguous positions are excluded from the fit and clearly labeled as inferred.',
 'The regular slot follows the side strokes within 4.75 source pixels. The manually located end centerlines are visually accepted; the regular capsule and uniform pitch are reconstruction assumptions.',
 'The right-pivot pawl passes in front of the left-pivot pawl at their crossing. The engraving does not reveal axial thickness, hook relief or bearing construction. These measurements do not establish a valid motion or contact solution.'
];
fs.writeFileSync(base+'080-source-inspections.json',JSON.stringify({movement:80,created:new Date().toISOString(),
 productionChanged:false,mechanicsPassed:false,inspected:true,adopted:true,observations,
 measurements:{file,sha256:hash(file)},image:r.image,
 script:{file:'scripts/prepare-crossed-rack-source.mjs',sha256:hash('scripts/prepare-crossed-rack-source.mjs')}},null,2)+'\n',{flag:'wx'});
const data={center:r.sourceCenter,scale:r.sourceScale,
 circles:Object.fromEntries(Object.entries(r.circles).map(([k,c])=>[k,{center:c.center,radius:c.radius}])),
 pitch:r.commonPitch,toothOrigins:{left:r.teeth.left.commonPitchOrigin,right:r.teeth.right.commonPitchOrigin},
 slot:{left:r.slot.left,right:r.slot.right,top:r.slot.top,bottom:r.slot.bottom},teeth:16};
fs.writeFileSync('scripts/lib/crossed-rack-source.mjs','// Adopted measurements: artifacts/review/080-source-inspections.json.\nexport default '+JSON.stringify(data,null,2)+';\n',{flag:'wx'});
console.log({adopted:true,teethPerSide:16,pitch:r.commonPitch,sourceScale:r.sourceScale,productionChanged:false});
