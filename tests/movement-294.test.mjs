import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredCylinderEscapementMovement as create} from '../src/simulation/authored-cylinder-escapements.js';

test('294 retains Brown’s hollow perspective cylinder and fifteen connected raised teeth',()=>{
 const m=create({id:294}),d=m.root.userData,b=d.blocks,g=d.geometry;
 assert.equal(b.palletHeads.length,15);assert.equal(d.sourceAnimation.available,false);assert.equal(d.sourceReference.plate294.imageWidth,525);
 assert.ok(g.workingBandStartZ<0&&g.workingBandEndZ>0);assert.ok(g.cylinderInnerRadius<g.cylinderOuterRadius);
 assert.equal(b.palletFeet.length,15);assert.equal(b.workingShell.parent,b.cylinderAssembly);assert.equal(b.balanceHub.parent,b.cylinderAssembly);
 assert.ok(d.cylinderContactBake.pointRadius<d.cylinderContactBake.heelRadius);
 assert.ok(Math.abs(Math.hypot(...d.cylinderContactBake.point)-d.cylinderContactBake.pointRadius)<1e-12,'compass point direction must be unit length');
});
test('294 baked finite path advances one tooth with two opposed impulse directions and finite drops',()=>{
 const d=create({id:294}).root.userData;let previous=Infinity;const modes=new Set();
 for(let i=0;i<=1024;i++){const s=d.stateAtTime(i/1024*4);assert.ok(s.wheelAngle<=previous+1e-10);previous=s.wheelAngle;modes.add(s.contactMode);}
 for(const mode of['outside-frictional-rest','entry-lip-impulse','inside-frictional-rest','exit-lip-impulse',null])assert.ok(modes.has(mode));
 assert.ok(Math.abs(d.stateAtTime(4).wheelAngle-d.stateAtTime(0).wheelAngle+2*Math.PI/15)<1e-12);
 for(const q of[.22,.25]){const s=d.stateAtTime(q*4);assert.ok(s.contact.wheelMoment>1&&s.contact.cylinderMoment<-.2&&s.balanceAngularSpeed<0);}
 for(const q of[.74,.78]){const s=d.stateAtTime(q*4);assert.ok(s.contact.wheelMoment>1&&s.contact.cylinderMoment>.2&&s.balanceAngularSpeed>0);}
 for(const[a,z]of d.cylinderContactBake.dropIntervals){const lo=d.stateAtTime(a*4),mid=d.stateAtTime((a+z)*2),hi=d.stateAtTime(z*4);assert.equal(mid.contactMode,null);assert.ok(hi.wheelAngle<lo.wheelAngle-.005);assert.ok(Math.abs(lo.balanceAngle-hi.balanceAngle)<1e-12);}
});
test('294 playback uses the baked state and explicitly retains prescribed force/impact limits',()=>{
 const m=create({id:294}),d=m.root.userData;
 for(const q of[0,.22,.31,.5,.74,.82,.94,1,2.2]){m.update(q*4);const s=d.stateAtTime(q*4);assert.equal(d.blocks.wheelRotor.rotation.z,s.wheelAngle);assert.equal(d.blocks.cylinderAssembly.rotation.z,s.balanceAngle);assert.equal(d.blocks.contactMarker.visible,false);assert.equal(d.contacts.forceValidated,false);}
 assert.ok(d.minimumDisplayCycleSeconds>=6);assert.equal(d.hideGround,true);assert.match(d.reconstructionNote,/prescribed/);assert.equal(d.finiteContactReview.noPassiveForceValidation,true);
});
