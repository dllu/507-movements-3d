import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import profile from '../src/simulation/baked/radial-pin-mangle-pinion.js';
import {radialPinProfileAudit} from './helpers/radial-pin-profile.mjs';
const model=createAuthoredGearMovement({id:194}),d=model.root.userData,b=d.blocks;
const renderedProfile=b.pinion.userData.rotor.children[0].geometry.userData.plate.polygons[0][0].slice(0,-1).map(p=>p.map(Math.fround));

test('194 retains full isolated radial pins and useful finite pinion dimensions',()=>{
 assert.equal(b.pinRoots.length,25);assert.equal(b.toothPins.length,25);
 for(const pin of b.pinRoots){assert.equal(pin.geometry.parameters.radius,.052);assert.equal(pin.geometry.parameters.height,.13);}
 for(const pin of b.toothPins){assert.equal(pin.geometry.parameters.radius,.039);assert.equal(pin.geometry.parameters.height,.125);}
 assert.ok(profile.min>.28 && profile.min<.30);assert.equal(profile.max,.472);
 const geometry=b.pinion.userData.rotor.children[0].geometry;geometry.computeBoundingBox();
 assert.ok(Math.abs(geometry.boundingBox.min.z+.185)<1e-7);assert.ok(Math.abs(geometry.boundingBox.max.z-.185)<1e-7);
 assert.equal(d.radialPinContact.status,'partial');
});
test('194 finite fixed profile clears every radial pin through both runs and terminal reversals',t=>{
 const result=radialPinProfileAudit(model,renderedProfile,Array.from({length:513},(_,i)=>i/512));
 t.diagnostic(JSON.stringify(result));
 assert.ok(result.minimum>.00005,`finite capsule clearance ${result.minimum}`);
 assert.ok(result.maxWorking<.0091,`documented working gap ${result.maxWorking}`);
 assert.equal(Object.keys(result.branches).length,4);
 // The bound intentionally permits a future improvement to exact engagement.
 assert.match(d.reconstructionNote,/working separation/);
});
test('194 removes the original pin-6 penetration witness without changing its path law',()=>{
 const result=radialPinProfileAudit(model,renderedProfile,[.90625]);
 assert.ok(result.minimum>.00005);assert.ok(result.maxWorking<.0091);
 assert.match(d.radialPinContact.motion,/prescribed-ideal/);
});
test('194 pinion repeats five finite tooth pairs and closes after 58 tooth pitches',()=>{
 const span=profile.points.length/5,a=2*Math.PI/5,c=Math.cos(a),s=Math.sin(a);
 for(let i=0;i<profile.points.length;i++){const p=profile.points[i],q=profile.points[(i+span)%profile.points.length];assert.ok(Math.hypot(p[0]*c-p[1]*s-q[0],p[0]*s+p[1]*c-q[1])<2e-10);}
 assert.ok(Math.abs(d.geometry.totalPinionTravel/(Math.PI/5)-58)<1e-12);
 const before=[];model.root.traverse(o=>before.push([o,o.geometry]));
 for(let i=0;i<32;i++){d.stateAtTime(i*.31);model.update(i*.31);}
 const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
});
