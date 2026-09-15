import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {AxiallySeparatedBand} from '../src/simulation/axially-separated-band.js';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

test('160 spatial full wrap preserves source projection, length and material no-slip',()=>{
 const v=createAuthoredCrankMovement({id:160}),u=v.root.userData,g=u.geometry;
 const lifted=time=>new AxiallySeparatedBand(u.stateAtTime(time).bandCurve,{startZ:.24,endZ:.72});
 try{
  const reference=lifted(0).getLength();let noSlipError=0,lengthError=0;
  for(let i=0;i<=64;i++){
   const t=4*i/64,s=u.stateAtTime(t),band=lifted(t),dt=1e-5,before=lifted(t-dt),after=lifted(t+dt);
   assert.ok(Math.abs(band.getLength()-reference)<1e-12);
   let polygonLength=0,previous;
   for(let j=0;j<=4096;j++){
    const f=j/4096,p=band.getPoint(f),flat=s.bandCurve.getPoint(f);
    assert.ok(Math.hypot(p.x-flat.x,p.y-flat.y)<1e-12);
    if(previous)polygonLength+=previous.distanceTo(p);previous=p;
   }
   lengthError=Math.max(lengthError,Math.abs(polygonLength-reference));
   // A central difference at fixed material distance must match the velocity
   // of a rotating drum, including zero axial velocity. Stay inside contact.
   for(let j=1;j<16;j++){
    const distance=s.springSpanLength+s.pulleyWrapLength*j/16,f=distance/g.nominalBandLength,p=band.getPoint(f);
    const velocity=after.getPoint(f).sub(before.getPoint(f)).multiplyScalar(1/(2*dt));
    const expected=new Vector3(-p.y*s.pulleyAngularSpeed,p.x*s.pulleyAngularSpeed,0);
    noSlipError=Math.max(noSlipError,velocity.distanceTo(expected));
   }
  }
  console.log({maximumNoSlipVelocityError:noSlipError,maximumChordLengthError:lengthError});
  assert.ok(noSlipError<1e-7);assert.ok(lengthError<1e-5);
 }finally{disposeObject3D(v.root);}
});
