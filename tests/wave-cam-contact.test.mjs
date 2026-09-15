import test from 'node:test';
import assert from 'node:assert/strict';
import {waveCamSupportHeight,waveCamSeatedRocker} from '../src/simulation/wave-cam-contact.js';
const g={axisX:0,innerRadius:.6,outerRadius:2.6,rollerZ:2.2,rollerRadius:.8,rollerDepth:1.1,waves:6,meanY:2,amplitude:.35,pivot:[-3,.3],armLength:3};
test('165 full-roller support reduces to the exact flat-face result',()=>{
 const support=waveCamSupportHeight(0,.31,{...g,amplitude:0});assert.ok(Math.abs(support.height-(g.meanY-g.rollerRadius))<1e-12);
});
test('165 finite contact solution clears independently sampled roller surfaces',()=>{
 for(let phase=0;phase<=8;phase++){
  const angle=phase*Math.PI/24,s=waveCamSeatedRocker(angle,g);assert.ok(Math.abs(s.residual)<1e-10);
  let smallest=Infinity;
  for(let i=0;i<=256;i++)for(let j=0;j<=32;j++){
   const dx=g.rollerRadius*Math.sin(-Math.PI/2+Math.PI*i/256),x=s.center[0]+dx,z=g.rollerZ-g.rollerDepth/2+g.rollerDepth*j/32,r=Math.hypot(x-g.axisX,z);if(r<g.innerRadius||r>g.outerRadius)continue;
   const y=s.center[1]+Math.sqrt(Math.max(0,g.rollerRadius**2-dx**2)),face=g.meanY+g.amplitude*Math.cos(g.waves*(Math.atan2(x-g.axisX,z)-angle));smallest=Math.min(smallest,face-y);
  }
  assert.ok(smallest>=-1e-9,'no sampled part of the finite roller crosses the wave face');assert.ok(smallest<.004,'the solution remains seated, not arbitrarily lowered');
 }
});
test('165 increasing roller width cannot increase its admissible center height',()=>{
 for(let i=0;i<=16;i++){const angle=i*Math.PI/48,narrow=waveCamSupportHeight(.1,angle,{...g,rollerDepth:.1}),wide=waveCamSupportHeight(.1,angle,g);assert.ok(wide.height<=narrow.height+1e-12);}
});
