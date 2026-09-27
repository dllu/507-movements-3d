// Offline design and lift table for movement 390's two identical pawls.
// Each pawl is one flat bored link whose chisel nose lies in the V root of
// the fast ratchet: its working face along the steep driving flank and its
// underside running straight back over the tooth behind. The lift table is
// the least pawl rotation that keeps the finite outline clear of the finite
// ratchet as a function of the relative tooth phase: in overrun the pawl rides
// each tooth back and drops into the next root as the crest passes, and the
// carrier's overtravel past that drop is the backlash it takes up before it
// drives. Mount frame: pivot at (pivotRadius, 0), pawl angle seatAngle + lift.
import fs from 'node:fs';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {dualBandPawlDimensions as d,dualBandToothPitch as pitch,dualBandSeatPhase as seat,ratchet390Outline} from '../src/simulation/dual-band-pawl-contact.js';
const rot=(q,a)=>[q[0]*Math.cos(a)-q[1]*Math.sin(a),q[0]*Math.sin(a)+q[1]*Math.cos(a)];
const area=mp=>mp.reduce((s,polygon)=>s+polygon.reduce((t,ring,k)=>{let A=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)A+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return t+(k?-1:1)*Math.abs(A/2);},0),0);
const P=[d.pivotRadius,0],width=.06,sagitta=.025,halfWidth=width/2,noseClearance=.0015,faceGap=d.seatClearance;
const outline0=ratchet390Outline(seat);
// The driving flank the seated pawl works on runs from root vertex 1 to crest vertex 2.
const root=outline0[1],crest=outline0[2];
let flank=[crest[0]-root[0],crest[1]-root[1]];{const l=Math.hypot(...flank);flank=[flank[0]/l,flank[1]/l];}
// Unit normal of the flank pointing into the valley (toward the pivot side).
let flankNormal=[flank[1],-flank[0]];if(flankNormal[0]*(P[0]-root[0])+flankNormal[1]*(P[1]-root[1])<0)flankNormal=[-flankNormal[0],-flankNormal[1]];
// Nose vertex: the root corner, lifted a hair off the root and faceGap off the flank.
const outward=[root[0]/Math.hypot(...root),root[1]/Math.hypot(...root)];
const A=[root[0]+noseClearance*outward[0]+faceGap*flankNormal[0],root[1]+noseClearance*outward[1]+faceGap*flankNormal[1]];
// Brown's pawls are small curled links. The body is a circular arc band from
// the pivot to the nose, bowed outward: at the nose its underside leaves the
// root tilted away from the tooth back behind, and the bow carries the band
// clear over that tooth; the round boss closes the pivot end.
const outwardOf=(o,q)=>{const v=[q[0]-o[0],q[1]-o[1]],l=Math.hypot(...v);return[v[0]/l,v[1]/l];};
function arcThrough(C){const M=[(P[0]+C[0])/2,(P[1]+C[1])/2],L=Math.hypot(C[0]-P[0],C[1]-P[1]);let nc=[-(C[1]-P[1])/L,(C[0]-P[0])/L];if(nc[0]*M[0]+nc[1]*M[1]<0)nc=[-nc[0],-nc[1]];const R=(L*L/4+sagitta*sagitta)/(2*sagitta),O=[M[0]-nc[0]*(R-sagitta),M[1]-nc[1]*(R-sagitta)];return{O,R};}
let C=A;for(let i=0;i<40;i++){const{O}=arcThrough(C),e=outwardOf(O,A);C=[A[0]+halfWidth*e[0],A[1]+halfWidth*e[1]];}
const{O,R}=arcThrough(C),angP=Math.atan2(P[1]-O[1],P[0]-O[0]);let angC=Math.atan2(C[1]-O[1],C[0]-O[0]);while(angC-angP>Math.PI)angC-=2*Math.PI;while(angC-angP<-Math.PI)angC+=2*Math.PI;
const span=angC-angP,a0=angP-.1*span,a1=angC+.25*span,band=[];
for(let i=0;i<=96;i++){const a=a0+(a1-a0)*i/96;band.push([O[0]+(R+halfWidth)*Math.cos(a),O[1]+(R+halfWidth)*Math.sin(a)]);}
for(let i=96;i>=0;i--){const a=a0+(a1-a0)*i/96;band.push([O[0]+(R-halfWidth)*Math.cos(a),O[1]+(R-halfWidth)*Math.sin(a)]);}
const axis=Math.atan2(A[1]-P[1],A[0]-P[0]);
const big=2,faceThrough=[root[0]+faceGap*flankNormal[0],root[1]+faceGap*flankNormal[1]];
const faceHalf=[[faceThrough[0]+big*flank[0],faceThrough[1]+big*flank[1]],[faceThrough[0]+big*flank[0]+big*flankNormal[0],faceThrough[1]+big*flank[1]+big*flankNormal[1]],[faceThrough[0]-big*flank[0]+big*flankNormal[0],faceThrough[1]-big*flank[1]+big*flankNormal[1]],[faceThrough[0]-big*flank[0],faceThrough[1]-big*flank[1]]];
const body=clip.intersection([band],[faceHalf]);
if(body.length!==1)throw Error('pawl body not one piece');
const toLocal=q=>rot([q[0]-P[0],q[1]-P[1]],-d.seatAngle);
const outline=body[0][0].slice(0,-1).map(toLocal).map(q=>q.map(v=>+v.toFixed(9)));
const pawlAt=lift=>[outline.map(q=>{const r=rot(q,d.seatAngle+lift);return[r[0]+P[0],r[1]+P[1]];})];
const hits=(lift,q)=>area(clip.intersection([pawlAt(lift)],[ratchet390Outline(seat+q)]))>1e-10;
// Lifting (negative rotation, as the old envelope) must raise the nose.
{const nearest=poly=>Math.min(...poly[0].map(v=>Math.hypot(...v)));if(nearest(pawlAt(-.05))<=nearest(pawlAt(0)))throw Error('lift sign');}
if(hits(0,0)){const r=clip.intersection([pawlAt(0)],[ratchet390Outline(seat)]);console.log(JSON.stringify(r),JSON.stringify(pawlAt(0)),A,P,axis);throw Error('pawl not clear when seated');}
const count=1024;
const lifts=Array.from({length:count},(_,s)=>{const q=pitch*s/count;if(!hits(0,q))return 0;let lo=0,hi=-.02;while(hits(hi,q)){lo=hi;hi-=.02;if(hi<-1.2)throw Error('no clear lift');}for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(hits(mid,q))lo=mid;else hi=mid;}return +(hi-.0006).toFixed(9);});
// Clear lift intervals at each phase (the pose set is not connected: just
// after a crest passes, the falling nose is clear high above the root and in
// the root, but not in between while the flank still stands in front of it).
// Playback lets a falling pawl descend at a finite rate inside these sets.
const step=.0025,levels=241;
const clearSets=lifts.map((_,s)=>{const q=pitch*s/count,out=[];let open=null;for(let k=0;k<=levels;k++){const l=-k*step,ok=k<levels&&!hits(l,q);if(ok&&open===null)open=l;if(!ok&&open!==null){out.push([+open.toFixed(4),+(l+step).toFixed(4)]);open=null;}}return out;});
const out={clearSets,clearStep:step,count,pitch,width,sagitta,axisOffset:+(axis-d.seatAngle).toFixed(12),length:+Math.hypot(A[0]-P[0],A[1]-P[1]).toFixed(12),outline,lifts};
fs.writeFileSync(new URL('../src/simulation/dual-band-pawl-profile.js',import.meta.url),`// Generated by scripts/generate-dual-band-pawl-contact.mjs: movement 390's finite pawl outline\n// (mount frame, local x at the seat angle) and least-clearance lift against relative tooth phase.\nexport const dualBand390Pawl = ${JSON.stringify(out)};\n`);
const seated=lifts.findIndex(v=>v!==0);console.log({seatedUntil:seated/count*pitch,overtravel:d.overtravel,max:Math.min(...lifts),points:outline.length,R,nose:toLocal(A)});
