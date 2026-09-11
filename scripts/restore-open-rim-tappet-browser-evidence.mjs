import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'artifacts/review/', backup = directory + '070-prior-browser-evidence/';
const saved = JSON.parse(await readFile(backup + 'manifest.json', 'utf8'));
const exit = JSON.parse(await readFile(directory + '070-browser-tests-exit-status.json', 'utf8'));
if (exit.code !== 0 || exit.signal !== null) throw new Error('Full browser run has not passed');
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const latest = directory + '070-browser-regression-captures/';
await mkdir(latest); const rows = [];
for (const item of saved.frames) {
  if (await digest(backup + item.file) !== item.sha256) throw new Error('Preserved evidence changed: ' + item.file);
  await copyFile(directory + item.file, latest + item.file, constants.COPYFILE_EXCL);
  rows.push({ file: item.file, sha256: await digest(latest + item.file), inspectedInThisRun: false });
  await copyFile(backup + item.file, directory + item.file);
  if (await digest(directory + item.file) !== item.sha256) throw new Error('Restore failed: ' + item.file);
}
await writeFile(latest + 'manifest.json', JSON.stringify({
  reason: 'Preserve the 070 browser regression captures while restoring the previously inspected images at their historical paths.',
  priorEvidenceRestored: true, rows,
}, null, 2) + '\n', { flag: 'wx' });
console.log({ restoredFrames: rows.length });
