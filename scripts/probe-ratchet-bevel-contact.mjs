import { writeFile } from 'node:fs/promises';
import { probeRatchetBevelContact } from '../tests/helpers/ratchet-bevel-contact.mjs';
const report = probeRatchetBevelContact(Number(process.env.BEVEL_CONTACT_STEPS ?? 128));
await writeFile('artifacts/review/049-bevel-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.penetratingSamples) process.exitCode = 1;
