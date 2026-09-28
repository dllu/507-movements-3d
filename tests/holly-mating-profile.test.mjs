import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import mate from '../src/simulation/generated-holly-mate.js';

test('429 generated rounded conjugate rotors clear each other at every sampled pose',()=>{
  const report=JSON.parse(fs.readFileSync('docs/validation/429-mating-contact.json'));
  for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
  assert.ok(report.poses>=1025);
  assert.equal(report.penetratingPoses,0);
  assert.ok(report.maximumOverlapArea<1e-10);
  assert.ok(report.maximumGap<0.014,'the rotors stay in close running contact');
  // Conjugate by construction: the final swept relief of the right rotor
  // removes essentially nothing.
  assert.ok(mate.rightReliefAreaFraction<1e-6);
  assert.equal(mate.teeth,18);
  assert.ok(mate.pistonTipRadius<5.333333*0.36);
  assert.equal(mate.strips.left.length,2);
  assert.equal(mate.strips.right.length,2);
});
