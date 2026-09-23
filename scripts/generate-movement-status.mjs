import {readFile, writeFile, access} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = new URL('docs/movement-status.json', root);
const target = new URL('docs/movement-status.md', root);
const data = JSON.parse(await readFile(source, 'utf8'));
const catalog = JSON.parse(await readFile(new URL('src/data/movements.json', root), 'utf8')).movements;
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/generate-movement-status.mjs [--check]');
if (data.movements.length !== 507) throw new Error('Expected exactly 507 movements');
const visualLabels = {yes: 'Yes', unverified: 'Unverified'};
const physicsLabels = {live: 'Yes — live', baked: 'Yes — baked', 'validation-only': 'No — study only', none: 'No', unknown: 'Unknown'};
const intersectionLabels = {known: 'Yes — see scope', 'sampled-clear': 'None in scoped checks', unknown: 'Unknown'};
const clean = text => String(text).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
const paths = new Set();
function evidence(path) {
  if (!path) return '';
  if (Array.isArray(path)) return path.map(evidence).join(', ');
  paths.add(path.split('#')[0]);
  return `[evidence](../${path})`;
}
const counts = key => Object.entries(data.movements.reduce((out, row) => {
  const status = key === 'mujoco' ? row[key].mode : row[key].status;
  out[status] = (out[status] ?? 0) + 1;
  return out;
}, {})).map(([status, count]) => `${status}: ${count}`).join('; ');
const lines = [
  '# Movement review status', '',
  'This is the current work ledger for all **507 movements**, not a completion certificate. '
    + 'Edit [movement-status.json](movement-status.json), then run `node scripts/generate-movement-status.mjs`. '
    + 'Update affected rows in every progress commit. The family queue selects reusable work; this ledger records each movement’s actual evidence.', '',
  `Last ledger update: **${data.updatedOn}**. Historical evidence was audited from repository review notes and production code.`, '',
  '- **Visual check:** Yes names the reviewer and means an attributable primary-agent comparison of rendered geometry with the engraving, not original authorship, a test pass, or merely creating a screenshot. Unverified means the record does not establish that attribution; a linked historical review may still exist. A visual check does not mean all flaws were fixed. Changes affecting appearance require a new check.',
  '- **MuJoCo:** live and baked both count as production simulation use. Study only means the installed motion is not MuJoCo-driven. Geometric contact tables and analytically generated animation are not MuJoCo bakes.',
  '- **Self intersections:** includes unintended interpenetration between mechanism parts. Known solver/contact overlap is also disclosed. “None in scoped checks” applies only to the interfaces, phases and tolerances in the cited evidence, not every pair at every instant. Unknown is not clean. Intended joined stock is not itself a defect.',
  '- **Remaining flaws:** specific open defects or qualification limits; “not established” never means flawless. Evidence links preserve the distinction between old failures, rejected studies and current production.', '',
  'For the next pass, group known intersection defects and concrete motion flaws by reusable component. '
    + 'Then fill visual-review and collision-evidence gaps. Update the affected rows after each correction; '
    + 'do not clear other limitations just because one scoped check passed.', '',
  `Visual: ${counts('visual')}.`, '',
  `MuJoCo: ${counts('mujoco')}.`, '',
  `Intersections: ${counts('intersections')}.`, '',
  '| Movement | Visually checked against engraving (reviewer) | Uses MuJoCo | Self intersections | Remaining flaws / limits |',
  '| --- | --- | --- | --- | --- |',
];
for (const [index, row] of data.movements.entries()) {
  if (row.id !== index + 1 || catalog[index].id !== row.id) throw new Error(`Missing, duplicate or unordered ID at row ${index + 1}`);
  if (!(row.visual.status in visualLabels) || !(row.mujoco.mode in physicsLabels) || !(row.intersections.status in intersectionLabels)) throw new Error(`Invalid status: ${row.id}`);
  if (!row.flaws?.trim()) throw new Error(`Missing residual assessment: ${row.id}`);
  if (row.mujoco.mode !== 'unknown' && !row.mujoco.evidence) throw new Error(`Missing production-route evidence: ${row.id}`);
  if (row.visual.status === 'yes' && (!row.visual.reviewer || !row.visual.evidence)) throw new Error(`Missing visual attribution: ${row.id}`);
  if (row.intersections.status !== 'unknown' && !row.intersections.evidence) throw new Error(`Missing intersection evidence: ${row.id}`);
  const number = String(row.id).padStart(3, '0');
  const reviewer = row.visual.status === 'yes' ? ` (${clean(row.visual.reviewer.split(' — ')[0])})` : '';
  const visual = `${visualLabels[row.visual.status]}${reviewer} ${evidence(row.visual.evidence)}`.trim();
  const physics = `${physicsLabels[row.mujoco.mode]} ${evidence(row.mujoco.evidence)}`.trim();
  const intersectionLabel = row.intersections.status === 'known' && row.intersections.kind === 'contact-overlap'
    ? 'Yes — contact overlap' : intersectionLabels[row.intersections.status];
  const intersections = `${intersectionLabel} ${evidence(row.intersections.evidence)}`.trim();
  for (const path of row.references ?? []) evidence(path);
  lines.push(`| [${number}](https://507movements.com/mm_${number}.html) | ${visual} | ${physics} | ${intersections} | ${clean(row.flaws)} |`);
}
for (const path of paths) {
  if (path.startsWith('/') || path.includes('..') || /^\w+:/.test(path)) throw new Error(`Evidence must be a repository path: ${path}`);
  await access(new URL(path, root));
}
const markdown = `${lines.join('\n')}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== markdown) throw new Error('Status table is stale; regenerate it');
  console.log(`507 unique rows validated; ${paths.size} evidence files exist; generated table is current.`);
} else {
  await writeFile(target, markdown);
  console.log(`Wrote 507 rows to ${target.pathname}`);
}
