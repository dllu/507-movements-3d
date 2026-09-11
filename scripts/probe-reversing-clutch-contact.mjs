import { writeFile } from 'node:fs/promises';
import { probeReversingClutchContact } from '../tests/helpers/reversing-clutch-contact.mjs';
const report = probeReversingClutchContact(Number(process.env.CONTACT_INTERVALS ?? 128));
await writeFile('artifacts/review/053-contact.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.penetratingSamples) process.exitCode = 1;
