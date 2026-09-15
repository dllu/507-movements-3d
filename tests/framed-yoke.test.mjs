import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeFramedYoke,framedYokeDimensions as g} from '../src/simulation/framed-yoke.js';
import {solidSurface} from './helpers/solid-surface.mjs';

test('146 uses measured wrist and yoke proportions with full-stroke guide engagement',()=>{
 const model=makeFramedYoke();
 try{
  const {parts}=model.root.userData;
  const source=model.root.userData.state;
  assert.ok(Math.abs(source.x/g.scale+8)<1e-12);
  assert.ok(Math.abs(source.y/g.scale-93)<1e-12);
  const body=parts['framed-grooved-yoke'];body.geometry.computeBoundingBox();
  assert.ok(Math.abs(body.geometry.boundingBox.getSize(new Vector3()).x/g.scale-327)<1e-4);
  const solid=solidSurface(body.geometry);
  for(let i=0;i<=256;i++){
   model.update(g.period*i/256);const state=model.root.userData.state;
   assert.ok(Math.abs(Math.hypot(state.x,state.y)/g.scale-Math.hypot(8,93))<1e-12);
   assert.ok(g.upperStem[0]+state.y<g.guides[0]-.2);
   assert.ok(g.upperStem[1]+state.y>g.guides[0]+.2);
   assert.ok(g.lowerStem[0]+state.y<g.guides[1]-.2);
   assert.ok(g.lowerStem[1]+state.y>g.guides[1]+.2);
   for(const sign of [-1,1])assert.ok(solid.signedDistance(new Vector3(state.x,sign*g.wristRadius,-.32))>.00049);
   assert.ok(model.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(model.root,true)));
  }
  model.reset();assert.deepEqual(model.root.userData.state,source);
  model.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
 }finally{model.dispose();}
});
