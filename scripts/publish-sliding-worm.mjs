import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=file=>JSON.parse(fs.readFileSync(file)),hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bundle=read('/dev/shm/143-candidate.json'),asset='/dev/shm/143-candidate.json.gz',assetSha256=hash(asset);
const contact=read('docs/validation/143-render-contact.json'),assembly=read('docs/validation/143-assembly.json');
assert.ok(contact.summary.poses>=65&&contact.summary.intersections===0&&contact.summary.minimumSeparationLowerBound>=1e-6);
assert.ok(contact.topology.every(t=>t.volume>0&&t.unmatchedEdges===0&&t.wrongNormals===0));
assert.ok(assembly.summary.poses>=65&&assembly.summary.failingPairs===0);
for(const report of [contact,assembly]){
 assert.equal(report.sources.find(s=>s.file===asset)?.sha256,assetSha256);
 for(const source of report.sources)assert.equal(hash(source.file),source.sha256,'Stale validation: '+source.file);
}
for(const source of bundle.sources)assert.equal(hash(source.file),source.sha256,'Stale bake: '+source.file);
const profile=read('/dev/shm/143-refined-profile.json');
const output='src/simulation/baked/assets/143.json.gz';fs.copyFileSync(asset,output);
const provenance={version:1,assetSha256,bytes:fs.statSync(output).size,sources:bundle.sources.filter(s=>!s.file.startsWith('/dev/shm/')),generatingProfile:{sha256:hash('/dev/shm/143-refined-profile.json'),parameters:profile.parameters,angularSteps:profile.profile.angularSteps,axialSteps:profile.profile.axialSteps,phaseSteps:profile.profile.phaseSteps,radialSteps:profile.profile.radialSteps,clearance:profile.profile.clearance},simplification:bundle.simplification,validation:['docs/validation/143-render-contact.json','docs/validation/143-assembly.json','docs/validation/143-envelope.json'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync('src/simulation/baked/assets/143.provenance.json',JSON.stringify(provenance,null,2)+'\n');console.log({output,bytes:provenance.bytes});
