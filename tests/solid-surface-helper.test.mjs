import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {solidSurface} from './helpers/solid-surface.mjs';

test('finite surface distances survive collapsed sphere and capsule pole triangles',()=>{
  for(const geometry of [new T.SphereGeometry(.2,24,16),new T.CapsuleGeometry(.24,.64,8,18)]) {
    const solid=solidSurface(geometry);
    for(const point of [new T.Vector3(0,0,0),new T.Vector3(.3,.4,.5),new T.Vector3(0,2,0)]) {
      assert.ok(Number.isFinite(solid.signedDistance(point)));
    }
    assert.ok(solid.signedDistance(new T.Vector3(0,0,0))<0);
    assert.ok(solid.signedDistance(new T.Vector3(0,2,0))>1);
    geometry.dispose();
  }
});
