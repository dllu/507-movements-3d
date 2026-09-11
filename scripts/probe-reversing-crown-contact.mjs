import { writeFile } from 'node:fs/promises';
import { probeReversingCrownContact } from '../tests/helpers/reversing-crown-contact.mjs';
const report = probeReversingCrownContact(Number(process.env.CROWN_CONTACT_STEPS ?? 128));
await writeFile('artifacts/review/053-crown-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (report.penetratingSamples || report.maximumToothGap > 0.0002) process.exitCode = 1;
