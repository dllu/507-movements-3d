import fs from 'node:fs';
import crypto from 'node:crypto';
import {createGzip, gunzipSync} from 'node:zlib';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const hashStudyFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Each input segment must fit in a JavaScript string after decoding. Long
// studies retain separate segments rather than constructing one giant input.
export function readStudyReport(file) {
  const bytes = fs.readFileSync(file);
  return JSON.parse((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
}

export function verifyStudySources(sources) {
  for (const source of sources) {
    if (hashStudyFile(source.file) !== source.sha256) throw Error('Changed study input: ' + source.file);
    if (source.archive && hashStudyFile(source.archive) !== source.sha256) throw Error('Changed study archive: ' + source.archive);
  }
}

export function freezeStudySources(files, prefix) {
  return [...new Set(files)].map((file, i) => {
    // Generated evidence already has an exclusive immutable output path.
    // Reference its exact bytes; retain separate snapshots of editable code.
    const archive = file.startsWith('artifacts/') ? undefined : prefix + '-source-' + i + '.txt';
    if (archive) fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
    return {file, ...(archive ? {archive} : {immutableArtifactReference: true}), sha256: hashStudyFile(file)};
  });
}

// Serialize one trajectory row at a time, respecting compressor backpressure.
// Publish only the complete exclusive output; preserve a partial on failure.
export async function writeGzipStudyReport(file, report, {chunkBytes = 1024 * 1024} = {}) {
  if (!file.endsWith('.json.gz')) throw Error('Expected a .json.gz output');
  if (!report || !Array.isArray(report.rows) || typeof report.toJSON === 'function') throw Error('Expected a plain report with rows');
  if (!Number.isInteger(chunkBytes) || chunkBytes < 1) throw Error('Invalid chunk size');
  if (fs.existsSync(file)) throw Error('Study report already exists: ' + file);
  const partial = file + '.partial', hash = crypto.createHash('sha256');
  const stats = {uncompressedBytes: 0, compressedBytes: 0, chunks: 0, maximumChunkBytes: 0};
  function* texts() {
    yield '{'; let first = true;
    for (const key of Object.keys(report)) {
      const encoded = key === 'rows' ? null : JSON.stringify(report[key]);
      if (encoded === undefined) continue;
      if (!first) yield ','; first = false;
      yield JSON.stringify(key) + ':';
      if (key !== 'rows') {yield encoded; continue;}
      yield '[';
      for (let i = 0; i < report.rows.length; i++) {
        if (i) yield ',';
        yield JSON.stringify(report.rows[i]) ?? 'null';
      }
      yield ']';
    }
    yield '}\n';
  }
  function* chunks() {
    for (const text of texts()) {
      const bytes = Buffer.from(text);
      for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
        const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkBytes));
        hash.update(chunk); stats.uncompressedBytes += chunk.length; stats.chunks++;
        stats.maximumChunkBytes = Math.max(stats.maximumChunkBytes, chunk.length);
        yield chunk;
      }
    }
  }
  await pipeline(Readable.from(chunks()), createGzip({level: 6}), fs.createWriteStream(partial, {flags: 'wx'}));
  const fd = fs.openSync(partial, 'r');
  try {fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  fs.linkSync(partial, file); fs.unlinkSync(partial);
  stats.compressedBytes = fs.statSync(file).size;
  return {...stats, uncompressedSha256: hash.digest('hex')};
}
