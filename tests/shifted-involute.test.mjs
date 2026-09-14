import test from 'node:test';
import assert from 'node:assert/strict';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';

test('profile-shifted rack generation retains the analytic involute working flanks',()=>{
 const n=12,m=.087,alpha=Math.PI/9,x=.8502401266088908,R=n*m/2,backlash=m*.008;
 const g=roundedRackGear({teeth:n,module:m,depth:.24,boreRadius:.2,profileShift:x,addendum:.8,dedendum:1.25,tipRadius:.12*m,samples:256,cutterSteps:4096});
 try{
  const ps=g.userData.outline.slice(128,256),inv=a=>Math.tan(a)-a;
  for(const r of [.56,.58,.60,.62]){
   let measured;
   for(let i=0;i<ps.length-1;i++){
    const a=ps[i],b=ps[i+1],d=b.clone().sub(a),aa=d.lengthSq(),bb=2*a.dot(d),cc=a.lengthSq()-r*r,disc=bb*bb-4*aa*cc;
    if(disc<0)continue;for(const t of [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>=0&&t<=1){const q=a.clone().addScaledVector(d,t);measured=Math.atan2(q.y,q.x);}
   }
   const analytic=Math.PI/(2*n)+2*x*Math.tan(alpha)/n-backlash/(2*R)-(inv(Math.acos(R*Math.cos(alpha)/r))-inv(alpha));
   assert(Number.isFinite(measured));assert(Math.abs(measured-analytic)<.00015,JSON.stringify({r,measured,analytic}));
  }
 }finally{g.dispose();}
});
