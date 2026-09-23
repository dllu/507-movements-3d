import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function snapshot(commit, file) {
  try {
    return execFileSync('git', ['show', `${commit}:${file}`], {
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

// Historical reports describe geometry that later commits replaced or
// refactored, so their pinned hashes must match the snapshot the report was
// generated from rather than whatever the working tree holds now.
export function assertHistoricalSources(report, t) {
  assert.match(report.sourceCommit ?? '', /^[0-9a-f]{40}$/,
    'historical report records the commit its sources were hashed at');
  for (const source of report.sources) {
    if (sha256(fs.readFileSync(source.file)) === source.sha256) continue;
    const content = snapshot(report.sourceCommit, source.file);
    if (content === null) {
      t.skip(`git snapshot ${report.sourceCommit} unavailable for ${source.file}`);
      return false;
    }
    assert.equal(sha256(content), source.sha256,
      `${source.file} at ${report.sourceCommit}`);
  }
  return true;
}
