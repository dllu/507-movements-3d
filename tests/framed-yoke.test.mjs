import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeFramedYoke,framedYokeDimensions as g} from '../src/simulation/framed-yoke.js';
import {solidSurface} from './helpers/solid-surface.mjs';

test('146 uses measured wrist and yoke proportions with whole stems guided beyond the plate',()=>{
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
   for(const sign of [-1,1])assert.ok(solid.signedDistance(new Vector3(state.x,sign*g.wristRadius,-.32))>.00049);
   // The drawn mechanism stays framed; only the whole stems and their
   // guides run on past the plate edge.
   assert.ok(model.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(model.root.userData.blocks.input,true)));
   const yokeBox=new Box3().setFromObject(model.root.userData.blocks.yoke,true),fit=model.root.userData.cameraFitBounds;
   assert.ok(yokeBox.min.x>=fit.min.x&&yokeBox.max.x<=fit.max.x);
   // Each stem stays engaged in its guide through the whole stroke.
   for(const name of ['upper','lower']){const guide=new Box3().setFromObject(parts[`stem-guide-${name}`]);assert.ok(yokeBox.min.y<guide.min.y-.1&&yokeBox.max.y>guide.max.y+.1);}
  }
  // Drawn stem lengths: raster rows 50 and 485 relative to the wrist row 214.
  assert.ok(Math.abs(g.upperStem[1]/g.scale-164)<1e-9);
  assert.ok(Math.abs(g.lowerStem[0]/g.scale+271)<1e-9);
  // The stems run on whole into guides just past the plate edge.
  assert.equal(Object.keys(parts).filter(name=>/^stem-guide-(upper|lower)$/.test(name)).length,2);
  model.reset();assert.deepEqual(model.root.userData.state,source);
  model.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
 }finally{model.dispose();}
});
