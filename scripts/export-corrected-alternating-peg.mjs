import fs from 'node:fs';

const input='artifacts/review/077-corrected-playback.json';
for(const name of ['077-corrected-compression','077-corrected-contact-bounds','077-corrected-surfaces']){
  if(!JSON.parse(fs.readFileSync(`artifacts/review/${name}.json`)).passed)throw Error(`Failed correction check: ${name}`);
}
const cache=JSON.parse(fs.readFileSync(input));
const metadata=Object.fromEntries(['geometry','pitch','physics','physicsPeriod','playbackPeriod','epsilon'].map(key=>[key,cache[key]]));
fs.writeFileSync('src/data/alternating-peg-profile.js',
  '// Finite-contact correction; see artifacts/review/073-077-correction-notes.md.\n'
  +'// Rows: physical time, lever, wheel, upper pawl, lower pawl angles.\nexport default {\n'
  +Object.entries(metadata).map(([key,value])=>'  '+key+': '+JSON.stringify(value)+',').join('\n')
  +'\n  first: [\n'+cache.first.map(row=>'    '+JSON.stringify(row)).join(',\n')
  +'\n  ],\n  steady: [\n'+cache.steady.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ],\n};\n');
console.log({input,first:cache.first.length,steady:cache.steady.length});
