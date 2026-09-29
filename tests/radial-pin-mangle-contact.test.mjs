import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import profile from '../src/simulation/baked/radial-pin-mangle-pinion.js';
import {radialPinProfileAudit} from './helpers/radial-pin-profile.mjs';
const model=createAuthoredGearMovement({id:194}),d=model.root.userData,b=d.blocks;
const gear=b.pinion.userData.rotor.children[0];
const renderedProfile=gear.geometry.userData.pinionOutline;

test('194 carries Brown\'s 22 pins: flat radial stadium studs with round reversal studs at the ends',()=>{
 assert.equal(b.toothPins.length,22);
 b.toothPins.forEach((pin,index)=>{
  const end=index===0||index===21;
  assert.equal(pin.userData.halfLength,end?0:.065);
  assert.equal(pin.userData.radius,end?.08:.052);
  assert.equal(pin.userData.role,end?'round-reversal-stud-ending-single-pin-circle':'double-sided-radial-face-pin-on-single-pitch-circle');
  assert.ok(Math.abs(pin.rotation.z-pin.userData.pitchAngle)<1e-15,'stadium lies radially');
 });
 // Brown's 55.8 degree gap between the end pins, 21 equal pitches round the rest.
 const pitch=b.toothPins[1].userData.pitchAngle-b.toothPins[0].userData.pitchAngle;
 assert.ok(Math.abs(pitch*180/Math.PI-14.4857)<1e-3,`pin pitch ${pitch}`);
 assert.equal(profile.pinCount,22);
});
test('194 pinion is one flat extrusion of the baked ten-fold envelope with Brown\'s proportions',()=>{
 assert.equal(gear.geometry.parameters.options.bevelEnabled,false);
 gear.geometry.computeBoundingBox();
 assert.ok(Math.abs(gear.geometry.boundingBox.min.z+.185)<1e-7&&Math.abs(gear.geometry.boundingBox.max.z-.185)<1e-7);
 assert.equal(renderedProfile,profile.points);
 assert.equal(profile.teeth,10);assert.equal(profile.max,.5);
 assert.ok(profile.min>.34&&profile.min<.35,`root ${profile.min}`);
 const span=profile.points.length/10,a=2*Math.PI/10,c=Math.cos(a),s=Math.sin(a);
 for(let i=0;i<profile.points.length;i++){const p=profile.points[i],q=profile.points[(i+span)%profile.points.length];assert.ok(Math.hypot(p[0]*c-p[1]*s-q[0],p[0]*s+p[1]*c-q[1])<2e-9);}
 // Teeth about half the pitch thick at the pitch circle, like Brown's.
 const r=d.geometry.pinionPitchRadius,count=profile.points.filter(([x,y])=>Math.hypot(x,y)>=r).length;
 const thickness=count/profile.points.length*2*Math.PI*r/10;
 assert.ok(thickness>.11&&thickness<.15,`tooth thickness ${thickness}`);
 assert.ok(Math.abs(d.geometry.totalPinionTravel/(Math.PI/5)-52)<1e-12,'52 tooth pitches per cycle');
});
test('194 fixed pinion clears every pin and stays in working contact through both runs and both reversals',t=>{
 const result=radialPinProfileAudit(model,renderedProfile,Array.from({length:2049},(_,i)=>i/2048));
 t.diagnostic(JSON.stringify(result));
 assert.equal(Object.keys(result.branches).length,4);
 assert.ok(result.minimum>.0002,`clearance ${result.minimum}`);
 assert.ok(result.maxWorking<.0065,`working gap ${result.maxWorking}`);
 for(const branch of ['upper-right-terminal-reversal','upper-left-terminal-reversal'])
  assert.ok(result.branches[branch].max<.001,`${branch} holds its round stud: ${result.branches[branch].max}`);
 assert.ok(result.branches['outside-of-single-face-pin-circle'].max<.002);
 assert.match(d.reconstructionNote,/0\.006/);
 assert.equal(d.radialPinContact.motion,'prescribed-ideal-rolling');
});
test('194 geometry is fixed while the cycle plays',()=>{
 const before=[];model.root.traverse(o=>before.push([o,o.geometry]));
 for(let i=0;i<32;i++){d.stateAtTime(i*.31);model.update(i*.31);}
 const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
});
