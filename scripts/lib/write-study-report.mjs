import fs from 'node:fs';

// Study reports are plain JSON data with one potentially very large rows
// array. Serialize each row separately to avoid V8's whole-string limit.
// The exclusive partial file survives failures; publish only complete output.
export function writeStudyReport(file, report, {chunkBytes = 1024 * 1024} = {}) {
  if (!report || !Array.isArray(report.rows) || typeof report.toJSON === 'function') throw Error('Expected a plain study report with rows');
  if (!Number.isInteger(chunkBytes) || chunkBytes < 1) throw Error('Invalid output chunk size');
  if (fs.existsSync(file)) throw Error('Study report already exists: ' + file);
  const partial = file + '.partial', fd = fs.openSync(partial, 'wx');
  let pending = [], pendingBytes = 0, bytes = 0, writes = 0, maximumWriteBytes = 0;
  const flush = () => {
    if (!pendingBytes) return;
    const buffer = Buffer.from(pending.join('')); let offset = 0;
    while (offset < buffer.length) {
      const count = fs.writeSync(fd, buffer, offset, Math.min(chunkBytes, buffer.length - offset));
      if (count <= 0) throw Error('Study output write made no progress');
      offset += count; bytes += count; writes++; maximumWriteBytes = Math.max(maximumWriteBytes, count);
    }
    pending = []; pendingBytes = 0;
  };
  const append = text => {
    const size = Buffer.byteLength(text);
    if (pendingBytes + size > chunkBytes) flush();
    pending.push(text); pendingBytes += size;
    if (pendingBytes >= chunkBytes) flush();
  };
  try {
    append('{'); let first = true;
    for (const key of Object.keys(report)) {
      const encoded = key === 'rows' ? null : JSON.stringify(report[key]);
      if (encoded === undefined) continue;
      if (!first) append(','); first = false;
      append(JSON.stringify(key) + ':');
      if (key !== 'rows') {append(encoded); continue;}
      append('[');
      for (let i = 0; i < report.rows.length; i++) {
        if (i) append(',');
        append(JSON.stringify(report.rows[i]) ?? 'null');
      }
      append(']');
    }
    append('}\n'); flush(); fs.fsyncSync(fd);
  } finally {fs.closeSync(fd);}
  // Same-directory hard linking publishes atomically and refuses to replace
  // a report created meanwhile. Preserve the partial if publication fails.
  fs.linkSync(partial, file); fs.unlinkSync(partial);
  return {bytes, writes, maximumWriteBytes};
}
