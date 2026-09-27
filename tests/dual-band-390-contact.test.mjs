import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredDualBandRatchetMovement as create} from '../src/simulation/authored-dual-band-ratchets.js';
import {dualBandPawlDimensions as d, dualBandSeatPhase, ratchet390Outline, turn390, pawl390Angle,dualBandToothPitch} from '../src/simulation/dual-band-pawl-contact.js';
import {dualBand390Pawl} from '../src/simulation/dual-band-pawl-profile.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const area=mp=>mp.reduce((s,polygon)=>s+polygon.reduce((t,ring,k)=>{let A=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)A+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return t+(k?-1:1)*Math.abs(A/2);},0),0);
const pawlAt=angle=>[dualBand390Pawl.outline.map(q=>{const r=turn390(q,angle);return[r[0]+d.pivotRadius,r[1]];})];
const overlap=(angle,q)=>area(clip.intersection([pawlAt(angle)],[ratchet390Outline(dualBandSeatPhase+q)]));
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const model=create({id:390}),data=model.root.userData,b=data.blocks;
test('390 uses identical opposed curled chisel pawls seated in the V root, driving and self-seating',()=>{
  assert.ok(Math.abs(b.crossedPawl.userData.mountPhase-b.openPawl.userData.mountPhase-Math.PI)<1e-14);
  assert.equal(b.openCarrier.userData.pawlStop,null,'no extra stop pin');assert.equal(b.crossedCarrier.userData.pawlStop,null);
  const [po,pc]=[b.openCarrier,b.crossedCarrier].map(c=>c.userData.pawlBody.geometry.attributes.position.array);assert.deepEqual(Array.from(po),Array.from(pc),'both pawls identical');
  const outline=ratchet390Outline(dualBandSeatPhase),root=outline[1],crest=outline[2];
  const nose=pawlAt(d.seatAngle)[0].reduce((best,q)=>Math.hypot(q[0]-root[0],q[1]-root[1])<Math.hypot(best[0]-root[0],best[1]-root[1])?q:best);
  assert.ok(Math.hypot(nose[0]-root[0],nose[1]-root[1])<.003,'nose sits in the root corner');
  assert.equal(overlap(d.seatAngle,0),0,'seated pawl clears the ratchet');
  assert.ok(overlap(d.seatAngle,-.002)>0,'reverse relative motion is blocked by the driving flank');
  let f=[crest[0]-root[0],crest[1]-root[1]];const l=Math.hypot(...f);f=[f[0]/l,f[1]/l];let n=[f[1],-f[0]];if(n[0]*(d.pivotRadius-root[0])-n[1]*root[1]<0)n=[-n[0],-n[1]];
  assert.ok((root[0]-d.pivotRadius)*n[1]-root[1]*n[0]>.02,'flank reaction presses the pawl into its seat');
  assert.ok(root[0]*n[1]-root[1]*n[0]<-.2,'reaction drives the output in its intended direction');
  const width=Math.min(...dualBand390Pawl.outline.slice(10,60).map(q=>Math.hypot(...q)))>0;assert.ok(width&&dualBand390Pawl.width>=.04,'not a thin wire');
});
test('390 finite pawl, journal and stop surfaces remain clear through drive and return',()=>{
  const pairs=[];
  for(const[c,w]of[[b.openCarrier,b.openRatchet],[b.crossedCarrier,b.crossedRatchet]])for(const[name,a,target,minimum]of[
    ['pawl/ratchet',c.userData.pawlBody,w,-.00002],
    ['pin/bored eye',c.userData.pawlPin,c.userData.pawlBody,.0009],
    ['pawl/carrier face',c.userData.pawlBody,c.userData.pulley,.037],
  ])pairs.push({name,a,target,minimum,points:surfacePoints(a.geometry),field:solidSurface(target.geometry),gap:Infinity});
  for(let i=0;i<=512;i++){
    model.update(i/64);model.root.updateMatrixWorld(true);
    for(const p of pairs){const tr=p.target.matrixWorld.clone().invert().multiply(p.a.matrixWorld);for(const point of p.points){const q=point.clone().applyMatrix4(tr);if(p.field.box.distanceToPoint(q)>p.gap)continue;p.gap=Math.min(p.gap,p.field.signedDistance(q));}}
  }
  for(const p of pairs)assert.ok(p.gap>p.minimum,`${p.name}: ${p.gap}`);
});
test('390 baked return is continuous across crests, handoffs and cycle boundaries',()=>{
  let previous=data.stateAtTime(0),maxSpeed=0;
  const n=32768,dt=8/n;
  for(let i=1;i<=n;i++){
    const s=data.stateAtTime(i*dt);
    for(const key of['openPawl','crossedPawl'])maxSpeed=Math.max(maxSpeed,Math.max(0,previous[key].liftAngle-s[key].liftAngle)/dt);
    previous=s;
  }
  assert.ok(maxSpeed<40,`bounded pawl lifting speed ${maxSpeed} (drops snap as the crest passes)`);
  for(const q of[.01,.02,.2]){
    const a=pawl390Angle(q-1e-8),c=pawl390Angle(q+1e-8);
    assert.ok(Math.abs(a-c)<1e-5,'no seat-edge teleport');
  }
});
test('390 every driving phase keeps the nose in the root and the drop completes before pickup',()=>{
  let takeUpLifted=0;
  for(let i=0;i<1024;i++){
    const s=data.stateAtTime(i/128);
    for(const key of['openPawl','crossedPawl']){
      const p=s[key];
      if(p.active){assert.ok(Math.abs(p.liftAngle)<1e-12,'driving pawl is seated');assert.equal(overlap(d.seatAngle,p.relativeAngle-Math.round(p.relativeAngle/dualBandToothPitch)*dualBandToothPitch),0);}
      if(p.takingUp&&Math.abs(p.liftAngle)>1e-9)takeUpLifted++;
      // Every sampled pose is clear of the finite ratchet.
      const q=((p.relativeAngle%dualBandToothPitch)+dualBandToothPitch)%dualBandToothPitch;assert.ok(overlap(d.seatAngle+p.liftAngle,q)<2e-9,`${i} ${key}`);
    }
  }
  // Take-up only returns the small overtravel lift; the pawl is back in the root before it drives.
  for(const t of[data.timeline.events.crossedPawlTakesDrive,data.timeline.events.openPawlRetakesDrive]){const s=data.stateAtTime(t-1e-3);for(const key of['openPawl','crossedPawl'])if(s[key].takingUp)assert.ok(Math.abs(s[key].liftAngle)<1e-9,'seated just before pickup');}
});
test('390 state sampling and playback retain finite component geometry identities',()=>{
  const initial=[];model.root.traverse(o=>initial.push([o,o.geometry]));
  for(let i=0;i<64;i++){data.stateAtTime(i*.13);model.update(i*.13);}
  const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,initial);
});
