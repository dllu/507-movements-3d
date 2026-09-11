import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),prior=JSON.parse(fs.readFileSync('artifacts/review/078-verification-source-hashes.json')),
 changed=['src/simulation/authored-intermittent.js','tests/models.test.mjs','src/data/display-profiles.js','src/data/display-profiles.json'];
for(const [file,expected]of Object.entries(prior))if(!changed.includes(file)&&hash(file)!==expected)throw Error('Unrelated production input changed: '+file);
const added=['src/data/opposed-arm-profile.js','src/simulation/opposed-arm.js','src/simulation/opposed-arm-geometry.js','src/simulation/opposed-arm-motion.js',
 'tests/opposed-arm.test.mjs','tests/e2e/opposed-arm.spec.mjs',...['candidate','contact-study','forces-study','primary-bounds','playback','view-bounds'].map(n=>'scripts/lib/opposed-arm-'+n+'.mjs')],
 files=[...new Set([...Object.keys(prior),...added])].sort(),hashes=Object.fromEntries(files.map(file=>[file,hash(file)]));
fs.writeFileSync('artifacts/review/079-verification-source-hashes.json',JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log({files:files.length,unchangedPriorFiles:Object.keys(prior).length-changed.length});
