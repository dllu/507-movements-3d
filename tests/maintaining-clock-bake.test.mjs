import assert from 'node:assert/strict';
import test from 'node:test';
import paths from '../src/simulation/baked/maintaining-clock-clicks.js';
import {createAuthoredMaintainingPowerMovement as chain} from '../src/simulation/authored-maintaining-power.js';
import {createAuthoredGoingBarrelMovement as barrel} from '../src/simulation/authored-going-barrels.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';

for(const [id,build] of [[320,chain],[321,barrel]])test(`${id}: baked clicks retain the exact finite follower across teeth and reversals`,()=>{
  const model=build({id,description:''});
  try{
    for(const follower of model.root.userData.blocks.finiteClicks){
      const path=paths[follower.bakeKey];
      assert.ok(path,'playback has an offline path');
      assert.deepEqual(path.signature,follower.bakeSignature,'changed geometry needs rebaking');
      let maximumError=0;
      // Irrationally offset samples do not coincide with the baker's dyadic
      // refinement points. Include backward and multiple-tooth travel.
      for(let i=0;i<2048;i++){
        const phase=((i+.38196601125)/2048),angle=(phase+(i%7)-3)*path.pitch;
        const expected=follower.angleAt(angle),actual=follower.playbackAngleAt(angle);
        maximumError=Math.max(maximumError,Math.abs(actual-expected));
        assert.ok(Math.abs(actual-expected)<2e-6,`${follower.bakeKey}: phase ${phase}, error ${actual-expected}`);
        follower.update(angle);
        assert.equal(follower.group.rotation.z,actual);
      }
      assert.ok(Math.abs(follower.playbackAngleAt(0)-follower.angleAt(0))<2e-6);
      for(const turn of [-100,-1,0,1,100])assert.ok(Math.abs(follower.playbackAngleAt(turn*path.pitch)-follower.playbackAngleAt(0))<1e-11);
      console.log({key:follower.bakeKey,keys:path.knots.length,maximumError});
    }
  }finally{disposeMovementModel(model);}
});
