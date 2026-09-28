import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeFramedYoke,framedYokeDimensions as g,loopOffset} from '../src/simulation/framed-yoke.js';
import {solidSurface} from './helpers/solid-surface.mjs';

test('146 uses measured wrist and yoke proportions with whole stems running straight past the plate',()=>{
 const model=makeFramedYoke();
 try{
  const {parts}=model.root.userData;
  const source=model.root.userData.state;
  assert.ok(Math.abs(source.x/g.scale+8)<1e-12);
  assert.ok(Math.abs(source.y/g.scale-93)<1e-12);
  // Brown's pose: the wrist sits in the loop's top run and the loop centre
  // is at raster row 253.5, 53.5 px above the shaft.
  assert.ok(Math.abs(source.yokeY/g.scale-(307-g.sourceLoopCenterRow))<1);
  const body=parts['framed-grooved-yoke'];body.geometry.computeBoundingBox();
  // Constant 30 px wall round the groove: the frame's half-width is the
  // crank radius plus groove half-width and wall.
  assert.ok(Math.abs(body.geometry.boundingBox.getSize(new Vector3()).x/g.scale-2*(Math.hypot(8,93)+42))<1e-3);
  // Frame top and bottom at Brown's rows 174 and 332 (within 3 px).
  assert.ok(Math.abs((g.loopHalfHeight+g.frameOffset)/g.scale-(g.sourceLoopCenterRow-174))<3);
  assert.ok(Math.abs((g.loopHalfHeight+g.frameOffset)/g.scale-(332-g.sourceLoopCenterRow))<3);
  const solid=solidSurface(body.geometry);
  let minY=Infinity,maxY=-Infinity;
  for(let i=0;i<=256;i++){
   model.update(g.period*i/256);const state=model.root.userData.state;
   assert.ok(Math.abs(Math.hypot(state.x,state.y)/g.scale-Math.hypot(8,93))<1e-12);
   minY=Math.min(minY,state.yokeY);maxY=Math.max(maxY,state.yokeY);
   // The wrist centre lies on the loop's centre line (a stadium reaching the
   // crank radius), and its whole circle clears both groove walls and sits
   // in the open groove, above the floor.
   const rel=new Vector3(state.x,state.y-state.yokeY,0);
   const R=g.loopHalfWidth,h=g.loopHalfHeight,straight=R-h;
   const along=Math.abs(rel.x)<=straight?Math.abs(Math.abs(rel.y)-h):Math.abs(Math.hypot(Math.abs(rel.x)-straight,rel.y)-h);
   assert.ok(along<1e-9);
   for(let k=0;k<16;k++){
    const a=k*Math.PI/8,p=new Vector3(rel.x+g.wristRadius*Math.cos(a),rel.y+g.wristRadius*Math.sin(a),-.30);
    assert.ok(solid.signedDistance(p)>.005,'wrist clears the groove walls');
   }
   assert.ok(solid.inside(new Vector3(rel.x,rel.y,-.40)),'groove floor under the wrist');
   assert.ok(!solid.inside(new Vector3(rel.x,rel.y,-.20)),'groove open above the floor');
   // The drawn mechanism stays framed; only the whole stems run on past
   // the plate edge.
   assert.ok(model.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(model.root.userData.blocks.input,true)));
   const yokeBox=new Box3().setFromObject(model.root.userData.blocks.yoke,true),fit=model.root.userData.cameraFitBounds;
   assert.ok(yokeBox.min.x>=fit.min.x&&yokeBox.max.x<=fit.max.x);
   // p60: no guides. Each stem's clean end stays past the framed view
   // through the whole stroke.
   assert.ok(yokeBox.min.y<fit.min.y&&yokeBox.max.y>fit.max.y);
  }
  // Stroke: the crank radius less the loop's half-height either way.
  assert.ok(Math.abs(maxY-g.stroke)<1e-3&&Math.abs(minY+g.stroke)<1e-3);
  // The motion is continuous: no jump in the yoke's position between samples.
  let last=null,jump=0;
  for(let i=0;i<=4096;i++){model.update(g.period*i/4096);const y=model.root.userData.state.yokeY;if(last!==null)jump=Math.max(jump,Math.abs(y-last));last=y;}
  assert.ok(jump<.01);
  assert.equal(loopOffset(g.crankRadius,0),0);
  // Drawn stem ends: raster rows 50 and 485 relative to the loop centre.
  assert.ok(Math.abs(g.upperStem[1]/g.scale-203.5)<1e-9);
  assert.ok(Math.abs(g.lowerStem[0]/g.scale+231.5)<1e-9);
  // The stems run on straight with no added guides (p60 support policy).
  assert.equal(Object.keys(parts).filter(name=>/guide/.test(name)).length,0);
  // The disk and its hub are see-through in the shared style.
  for(const name of ['driver-disk','disk-front-hub'])assert.equal(parts[name].userData.seeThrough,true);
  model.reset();assert.deepEqual(model.root.userData.state,source);
  model.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
 }finally{model.dispose();}
});
