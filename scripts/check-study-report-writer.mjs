import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {writeStudyReport} from './lib/write-study-report.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/082-bounded-report-writer';
const input = 'artifacts/review/082-source-seat-finest-dynamics.json';
const original = JSON.parse(fs.readFileSync(input));
const report = {...original, rows: original.rows.slice(0, 1024), unicode: 'wheel → pawl ⚙', omitted: undefined,
  extras: [null, undefined, , Infinity, -0, 'line\nquote"']};
const output = prefix + '-example.json', expected = JSON.stringify(report) + '\n';
const result = writeStudyReport(output, report, {chunkBytes: 4096});
assert.equal(fs.readFileSync(output, 'utf8'), expected);
assert(result.writes > 100 && result.maximumWriteBytes <= 4096);
assert(!fs.existsSync(output + '.partial'));
assert.throws(() => writeStudyReport(output, {rows: []}), /already exists/);
assert.equal(fs.readFileSync(output, 'utf8'), expected);
const cyclic = {}; cyclic.self = cyclic;
const failureOutput = prefix + '-intentional-failure.json';
assert.throws(() => writeStudyReport(failureOutput, {rows: [1, cyclic]}, {chunkBytes: 1}), /circular/i);
assert(!fs.existsSync(failureOutput)); assert(fs.existsSync(failureOutput + '.partial'));
assert.throws(() => writeStudyReport(failureOutput, {rows: []}), /EEXIST/);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const prior = JSON.parse(fs.readFileSync('artifacts/review/082-finest-audit-checkpoint.json'));
const changed = prior.sources.filter(s => hash(s.file) !== s.sha256);
assert.deepEqual(changed.map(s => s.file), ['scripts/study-treadle-ratchet-dynamics.mjs']);
const old = fs.readFileSync(changed[0].archive, 'utf8'), current = fs.readFileSync(changed[0].file, 'utf8');
const normalized = current.replace("import {writeStudyReport} from './lib/write-study-report.mjs';\n", '')
  .replace("'scripts/lib/write-study-report.mjs', ", '')
  .replace('writeStudyReport(output, report);', "fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\\n', {flag: 'wx'});");
assert.equal(normalized, old, 'The runner changed beyond writer import, dependency archive and serialization call');
const files = ['scripts/check-study-report-writer.mjs', 'scripts/lib/write-study-report.mjs', changed[0].file];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const record = {movement: 82, status: 'bounded-report-writer-check', passed: true, result,
  rows: report.rows.length, nativeCompactBytesExactlyMatched: true, existingOutputPreserved: true,
  failedPartialPreserved: true, incompleteReportNotPublished: true, priorStudySourcesUnchanged: prior.sources.length - changed.length,
  writerOnlyRunnerTransition: {file: changed[0].file, priorSha256: changed[0].sha256, currentSha256: hash(changed[0].file), exactNormalizedSourceMatched: true},
  input: {file: input, sha256: hash(input)}, sources,
  qualification: 'Real trajectory rows and JSON edge values serialize identically to native compact JSON in bounded writes. Failed serialization preserves its partial and never publishes a completed filename. Only the writer import, archived dependency and output call changed in the 082 runner; no solver or state transition changed.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
console.log(record);
