import { writeFile } from 'node:fs/promises';
import { probePinClutchContact } from '../tests/helpers/pin-clutch-contact.mjs';
const report = probePinClutchContact(Number(process.env.CONTACT_INTERVALS ?? 128));
await writeFile('artifacts/review/052-contact.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.penetratingSamples) process.exitCode = 1;
