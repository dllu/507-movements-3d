import { writeFile } from 'node:fs/promises';
import { probeReversingBevelContact } from '../tests/helpers/reversing-bevel-contact.mjs';
const report = probeReversingBevelContact(Number(process.env.BEVEL_CONTACT_STEPS ?? 128));
await writeFile('artifacts/review/053-bevel-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (report.penetratingSamples) process.exitCode = 1;
