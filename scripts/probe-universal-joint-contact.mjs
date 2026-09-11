import { writeFile } from 'node:fs/promises';
import { probeUniversalJointContact } from '../tests/helpers/universal-joint-contact.mjs';

for (const id of [50, 51]) {
  const report = probeUniversalJointContact(id, Number(process.env.CONTACT_INTERVALS ?? 128));
  await writeFile(`artifacts/review/${String(id).padStart(3, '0')}-contact.json`, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report) + '\n');
  if (report.penetratingSamples) process.exitCode = 1;
}
