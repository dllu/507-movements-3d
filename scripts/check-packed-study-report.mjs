import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readStudyReport, writeGzipStudyReport, freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-packed-report-controls';
const input = 'artifacts/review/083-clock-bdf-tenth-us-full-quarter-ms.json', data = readStudyReport(input);
verifyStudySources(data.sources);
const cases = [
  {movement: 83, rows: [], omitted: undefined, null: null},
  {title: 'Unicode 🦈 and literal \\n', before: {values: [0, -0, null, true]},
    rows: [undefined, null, NaN, {quote: '"\\', large: 'α🦈'.repeat(10000)}], after: 'done'},
  {movement: 83, parameters: data.parameters, rows: data.rows.filter((_, i) => i % 17 === 0), sources: data.sources},
];
const results = [];
for (const [i, report] of cases.entries()) {
  const file = prefix + '-case-' + i + '.json.gz', expected = JSON.stringify(report) + '\n';
  const stats = await writeGzipStudyReport(file, report, {chunkBytes: 257});
  const decoded = gunzipSync(fs.readFileSync(file));
  assert.equal(decoded.toString('utf8'), expected);
  assert.deepEqual(readStudyReport(file), JSON.parse(expected));
  assert.equal(stats.uncompressedBytes, Buffer.byteLength(expected));
  assert.equal(stats.uncompressedSha256, crypto.createHash('sha256').update(expected).digest('hex'));
  assert(stats.maximumChunkBytes <= 257);
  await assert.rejects(writeGzipStudyReport(file, report), /already exists/);
  assert.equal(gunzipSync(fs.readFileSync(file)).toString('utf8'), expected);
  assert(!fs.existsSync(file + '.partial'));
  results.push({file, ...stats});
}
await assert.rejects(writeGzipStudyReport(prefix + '-invalid.json.gz', {rows: []}, {chunkBytes: 0}), /Invalid chunk/);
const sources = freezeStudySources(['scripts/check-packed-study-report.mjs', 'scripts/lib/study-report-io.mjs', input], prefix);
verifyStudySources(sources);
const report = {movement: 83, status: 'lossless-packed-study-report-controls', passed: true, productionChanged: false,
  results, sources, qualification: 'Gzip decoding reproduces native JSON bytes and parsed values, including real trajectory rows, metadata, Unicode, escapes and JSON null/omission semantics. Input chunk size and exclusive publication are checked. Reads still require each decoded segment to fit in a JavaScript string; no unbounded-reader claim is made.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
