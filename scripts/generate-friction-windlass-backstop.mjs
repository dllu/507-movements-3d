import fs from 'node:fs';
import {createAuthoredFrictionWindlassMovement as create} from '../src/simulation/authored-friction-windlasses.js';
const m=create({id:280}),d=m.root.userData,g=d.geometry,b=d.blocks,tau=2*Math.PI,pitch=g.ratchetToothPitch,root=g.ratchetRootRadius,tip=g.ratchetTipRadius;
const poly=[[root-.03,0],[tip,0],[(root)*Math.cos(.9*pitch),root*Math.sin(.9*pitch)],[(root-.03)*Math.cos(.9*pitch),(root-.03)*Math.sin(.9*pitch)]];
function polygonGap(p){let best=Infinity,inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],c=poly[i],v=[c[0]-a[0],c[1]-a[1]],w=[p[0]-a[0],p[1]-a[1]],t=Math.max(0,Math.min(1,(w[0]*v[0]+w[1]*v[1])/(v[0]*v[0]+v[1]*v[1])));best=Math.min(best,Math.hypot(w[0]-t*v[0],w[1]-t*v[1]));if((c[1]>p[1])!==(a[1]>p[1])&&p[0]<(a[0]-c[0])*(p[1]-c[1])/(a[1]-c[1])+c[0])inside=!inside;}return inside?-best:best;}
function gap(x,y,angle){let result=Math.hypot(x,y)-root;const at=Math.floor((Math.atan2(y,x)-angle)/pitch);for(let j=at-1;j<=at+1;j++){const a=angle+j*pitch,c=Math.cos(a),s=Math.sin(a);result=Math.min(result,polygonGap([c*x+s*y,-s*x+c*y]));}return result;}
const count=256,rows=[];
// The presented backstop is a similar figure shrunk by backstopScale about
// the wheel axis; solve in the unscaled frame the tooth profile uses.
const unscale=1/(g.backstopScale??1);
for(const pawl of[b.upperPawl,b.lowerPawl]){const P=pawl.position.clone().set(+(pawl.position.x*unscale).toFixed(12),+(pawl.position.y*unscale).toFixed(12),0),L=pawl.userData.length,base=pawl.userData.seatAngle;function clear(lift,phase){const a=base-lift,x=P.x+L*Math.cos(a),y=P.y+L*Math.sin(a);return gap(x,y,phase)-.10005;}
 const raw=Array.from({length:count},(_,i)=>{const phase=pitch*i/count;let hi=.8,lo=0,found=false;for(let k=99;k>=0;k--){const q=.8*k/100;if(clear(q,phase)<0){lo=q;found=true;break;}hi=q;}if(!found)return 0;for(let j=0;j<42;j++){const mid=(lo+hi)/2;if(clear(mid,phase)>=0)hi=mid;else lo=mid;}return hi;});
 // A periodic Lipschitz majorant starts the rise early and spreads the drop.
 // This is a prescribed finite-clearance envelope, not a passive seating solve.
 const lifts=raw.map((_,i)=>Math.max(...raw.map((v,j)=>v-2.5*Math.min(Math.abs(i-j),count-Math.abs(i-j))/count))+.004);
 rows.push({pivot:[P.x,P.y],length:L,base,lifts:lifts.map(v=>+v.toFixed(9))});}
fs.writeFileSync(new URL('../src/simulation/friction-windlass-backstop-data.js', import.meta.url),`// Offline finite-clearance envelope for the CCW ratchet. See review doc.\nexport const frictionBackstopData = ${JSON.stringify({count,pitch,profile:poly,rows},null,0)};\n`);
console.log(rows.map(r=>({minimum:Math.min(...r.lifts),maximum:Math.max(...r.lifts)})));
