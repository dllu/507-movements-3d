import assert from 'node:assert/strict';
import test from 'node:test';
import {applyDisplayTiming} from '../src/simulation/display-timing.js';
import {createAuthoredWaterBucketReciprocatorMovement} from '../src/simulation/authored-water-bucket-reciprocators.js';
import {createAuthoredTippingWaterMeterMovement} from '../src/simulation/authored-tipping-water-meters.js';
import {createAuthoredHydraulicRamMovement} from '../src/simulation/authored-hydraulic-rams.js';
import {createAuthoredRopeSteeringMovement} from '../src/simulation/authored-rope-steering.js';
import {createAuthoredLiftPumpMovement} from '../src/simulation/authored-lift-pumps.js';

for(const [id,factory] of [[439,createAuthoredWaterBucketReciprocatorMovement],
  [440,createAuthoredTippingWaterMeterMovement],[444,createAuthoredHydraulicRamMovement],
  [490,createAuthoredRopeSteeringMovement],[448,createAuthoredLiftPumpMovement],[449,createAuthoredLiftPumpMovement]]) {
  test(`${id} production display timing preserves the reviewed minimum cycle`,()=>{
    const movement={id},model=factory(movement);
    const period=model.root.userData.geometry.cycleDuration;
    applyDisplayTiming(model,movement);
    assert.ok(model.root.userData.animationTiming.displayCycleDuration>=period-1e-12);
    assert.ok(model.root.userData.animationTiming.playbackTimeScale<=1);
  });
}
