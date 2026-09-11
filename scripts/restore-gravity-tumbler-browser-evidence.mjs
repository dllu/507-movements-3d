import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = 'artifacts/review/', backup = root + '067-prior-browser-evidence/';
const saved = JSON.parse(await readFile(backup + 'manifest.json', 'utf8'));
const exit = JSON.parse(await readFile(root + '067-browser-tests-exit-status.json', 'utf8'));
if (exit.code !== 0 || exit.signal !== null) throw new Error('Full browser run has not passed');
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const latest = root + '067-browser-regression-captures/';
await mkdir(latest); const rows = [];
for (const item of saved.rows) {
  if (await digest(backup + item.file) !== item.sha256) throw new Error('Preserved evidence changed: ' + item.file);
  await copyFile(root + item.file, latest + item.file);
  rows.push({ file: item.file, sha256: await digest(latest + item.file), inspectedInThisRun: false });
  await copyFile(backup + item.file, root + item.file);
  if (await digest(root + item.file) !== item.sha256) throw new Error('Restore failed: ' + item.file);
}
await writeFile(latest + 'manifest.json', JSON.stringify({
  reason: 'Preserve this browser run’s refreshed captures while restoring the prior review images at their historical paths.',
  priorEvidenceRestored: true, rows,
}, null, 2) + '\n');
console.log({ restoredFrames: rows.length });
