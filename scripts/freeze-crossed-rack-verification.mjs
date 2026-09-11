import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),prior=JSON.parse(fs.readFileSync('artifacts/review/079-verification-source-hashes.json')),
 changed=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json','src/simulation/engine.js','src/main.js'];
for(const [file,expected]of Object.entries(prior))if(!changed.includes(file))assert.equal(hash(file),expected,file);
const added=['src/data/crossed-rack-profile.js','src/data/crossed-rack-source.js','src/simulation/crossed-rack.js','src/simulation/crossed-rack-geometry.js',
 'src/simulation/crossed-rack-motion.js','tests/crossed-rack.test.mjs','tests/e2e/crossed-rack.spec.mjs',
 ...['source','candidate','contact-study','dynamics-study','energy-study','mesh-prisms','triangle-bounds','playback-study'].map(n=>'scripts/lib/crossed-rack-'+n+'.mjs')],
 files=[...new Set([...Object.keys(prior),...added])].sort(),hashes=Object.fromEntries(files.map(file=>[file,hash(file)]));
fs.writeFileSync('artifacts/review/080-verification-source-hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log({files:files.length,unchangedPriorFiles:Object.keys(prior).length-changed.length,changedPriorFiles:changed});
