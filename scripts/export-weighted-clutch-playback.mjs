import fs from 'node:fs';
import {readStudyReport, hashStudyFile} from './lib/study-report-io.mjs';

const input = process.argv[2] ?? 'artifacts/review/087-periodic-playback-profile.json';
const profile = readStudyReport(input);
const fields = Object.entries(profile).map(([key, value]) => JSON.stringify(key) + ':' +
  (key === 'samples' ? '[\n' + value.map(row => JSON.stringify(row)).join(',\n') + '\n]' : JSON.stringify(value)));
fs.writeFileSync('src/data/weighted-clutch-profile.js',
  '// Contact-integrated trajectory from scripts/extract-weighted-clutch-periodic-playback.mjs.\n' +
  '// Input SHA-256: ' + hashStudyFile(input) + '\nexport default {\n' + fields.join(',\n') + '\n};\n');
console.log({input, sha256: hashStudyFile(input), samples: profile.samples.length});
