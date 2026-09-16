import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import mate from '../src/simulation/generated-holly-mate.js';

test('429 corrected rendered mating profile clears its mate without losing the source outline',()=>{
  const report=JSON.parse(fs.readFileSync('docs/validation/429-mating-contact.json'));
  for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
  assert.ok(report.poses>=1025);
  assert.equal(report.penetratingPoses,0);
  assert.ok(report.maximumOverlapArea<1e-10);
  assert.ok(report.maximumGap<0.014,'small source-profile contact gaps remain explicit');
  assert.ok(mate.retainedAreaFraction>0.997);
  assert.ok(mate.addedAreaFraction<1e-10);
  assert.ok(mate.maximumBoundaryChange<0.0145);
});
