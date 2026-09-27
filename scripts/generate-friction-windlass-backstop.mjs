// Offline design and lift table for movement 280's two holding pawls.
// Each pawl is one flat bored link whose chisel nose lies along the radial
// locking face and the preceding tooth's back, so at the hold it sits in the
// root. The lift table is the least pawl rotation that keeps the finite pawl
// outline clear of every finite tooth polygon (no rate limiting: a gravity
// click drops as soon as the tooth corner passes).
import fs from 'node:fs';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {createAuthoredFrictionWindlassMovement as create} from '../src/simulation/authored-friction-windlasses.js';
const m=create({id:280}),d=m.root.userData,g=d.geometry,b=d.blocks,tau=2*Math.PI,pitch=g.ratchetToothPitch,root=g.ratchetRootRadius,tip=g.ratchetTipRadius;
const profile=[[root-.03,0],[tip,0],[root*Math.cos(.9*pitch),root*Math.sin(.9*pitch)],[(root-.03)*Math.cos(.9*pitch),(root-.03)*Math.sin(.9*pitch)]];
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
const rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const area=mp=>mp.reduce((s,polygon)=>s+polygon.reduce((t,ring,k)=>{let A=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)A+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return t+(k?-1:1)*Math.abs(A/2);},0),0);
const unscale=1/(g.backstopScale??1);
const pivots=[b.upperPawl,b.lowerPawl].map(p=>[+(p.position.x*unscale).toFixed(12),+(p.position.y*unscale).toFixed(12)]);
// Brown's links run about 24 degrees below level into the wheel; each nose
// sits in the root nearest that line. The lower pawl is placed half a pitch
// out of phase so the two alternate on successive half-tooth strokes.
const plateSeatAngle=P=>{const u=[-Math.cos(24*Math.PI/180),-Math.sin(24*Math.PI/180)],along=P[0]*u[0]+P[1]*u[1],s=-along-Math.sqrt(along*along-(P[0]**2+P[1]**2)+tip*tip);return Math.atan2(P[1]+s*u[1],P[0]+s*u[0]);};
const upperFace=plateSeatAngle(pivots[0]);
const lowerTarget=plateSeatAngle(pivots[1]),k=-2;
const faces=[upperFace,upperFace+(k+.5)*pitch];
// The tooth pattern is turned so a locking face stands at upperFace.
const toothOffset=upperFace;
const width=.16,halfWidth=width/2,noseClearance=.0025,faceGap=.0012,backRelief=3*Math.PI/180;
const rows=faces.map((face,i)=>{
  const P=pivots[i];
  // Nose vertex at the root corner beside the locking face.
  const A=polar(root+noseClearance,face-(faceGap+noseClearance)/root);
  const base=Math.atan2(A[1]-P[1],A[0]-P[0]),length=Math.hypot(A[0]-P[0],A[1]-P[1]);
  const toLocal=q=>rot([q[0]-P[0],q[1]-P[1]],-base);
  // Working face: parallel to the radial locking face, faceGap clear of it.
  const radial=[Math.cos(face),Math.sin(face)],tangent=[-radial[1],radial[0]];
  // Back face: parallel to the preceding tooth's back, relieved outward.
  const backTop=polar(tip,face-pitch),backRoot=polar(root,face-.1*pitch);
  let back=[backTop[0]-backRoot[0],backTop[1]-backRoot[1]];const bl=Math.hypot(...back);back=[back[0]/bl,back[1]/bl];
  back=rot(back,backRelief);
  const big=4,side=(dir,normalSign)=>{// half-plane polygon through A: keep side opposite to normal*normalSign
    const n=[-dir[1]*normalSign,dir[0]*normalSign];return[[A[0]+big*dir[0],A[1]+big*dir[1]],[A[0]+big*dir[0]-big*n[0],A[1]+big*dir[1]-big*n[1]],[A[0]-big*dir[0]-big*n[0],A[1]-big*dir[1]-big*n[1]],[A[0]-big*dir[0],A[1]-big*dir[1]]];};
  // Keep the side of the working face with smaller polar angle (away from the tooth ahead).
  const choose=(dir,test)=>{for(const s of[1,-1]){const h=side(dir,s),inside=clip.intersection([h],[[[test[0]-1e-3,test[1]-1e-3],[test[0]+1e-3,test[1]-1e-3],[test[0]+1e-3,test[1]+1e-3],[test[0]-1e-3,test[1]+1e-3]]]);if(area(inside)>1e-7)return h;}throw Error('half-plane');};
  const faceHalf=choose(radial,polar(root+.06,face-.08));
  const backHalf=choose(back,polar(tip+.05,face-.02));
  const u=[Math.cos(base),Math.sin(base)],n=[-u[1],u[0]],far=length+.3;
  const strip=[[P[0]+halfWidth*n[0],P[1]+halfWidth*n[1]],[P[0]+far*u[0]+halfWidth*n[0],P[1]+far*u[1]+halfWidth*n[1]],[P[0]+far*u[0]-halfWidth*n[0],P[1]+far*u[1]-halfWidth*n[1]],[P[0]-halfWidth*n[0],P[1]-halfWidth*n[1]]];
  const body=clip.intersection([strip],[faceHalf],[backHalf]);
  if(body.length!==1)throw Error('pawl body not one piece');
  const outline=body[0][0].slice(0,-1).map(toLocal).map(p=>p.map(v=>+v.toFixed(9)));
  return{pivot:P,base,length,face,outline};
});
function teethAt(angle,near){const out=[];const j0=Math.round((near-toothOffset-angle)/pitch);for(let j=j0-2;j<=j0+2;j++){const a=toothOffset+angle+j*pitch;out.push([profile.map(p=>rot(p,a))]);}return out;}
function pawlAt(row,lift){const a=row.base-lift;return[row.outline.map(p=>{const q=rot(p,a);return[q[0]+row.pivot[0],q[1]+row.pivot[1]];})];}
const hits=(row,lift,angle)=>{const pawl=pawlAt(row,lift);for(const tooth of teethAt(angle,row.face)){if(area(clip.intersection([pawl],tooth))>2e-8)return true;}return false;};
// Lift sign: positive lift must raise the nose away from the axis.
for(const row of rows){const r0=Math.hypot(...pawlAt(row,0)[0].reduce((best,p)=>Math.hypot(...p)<Math.hypot(...best)?p:best)),r1=Math.hypot(...pawlAt(row,.05)[0].reduce((best,p)=>Math.hypot(...p)<Math.hypot(...best)?p:best));if(r1<r0)throw Error('lift sign');}
const count=512;
for(const[i,row]of rows.entries()){
  // The wheel angle at which this pawl holds: upper at 0, lower half a pitch on.
  const hold=i?(((k+.5)*pitch%pitch)+pitch)%pitch:0;row.hold=hold;
  if(hits(row,0,hold))throw Error(`pawl ${i} not clear when seated`);
  row.lifts=Array.from({length:count},(_,s)=>{const angle=pitch*s/count;if(!hits(row,0,angle))return 0;let lo=0,hi=.02;while(hits(row,hi,angle)){lo=hi;hi+=.02;if(hi>.6)throw Error('no clear lift');}for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(hits(row,mid,angle))lo=mid;else hi=mid;}return +(hi+.0004).toFixed(9);});
}
// Seated face gap along the working face at each hold (rendered geometry).
const out={count,pitch,toothOffset,overshoot:.0055,profile,rows:rows.map(r=>({pivot:r.pivot,base:+r.base.toFixed(12),length:+r.length.toFixed(12),face:+r.face.toFixed(12),hold:+r.hold.toFixed(12),outline:r.outline,lifts:r.lifts}))};
fs.writeFileSync(new URL('../src/simulation/friction-windlass-backstop-data.js', import.meta.url),`// Generated by scripts/generate-friction-windlass-backstop.mjs: finite pawl outlines and\n// least-clearance lift table for movement 280's CCW backstop.\nexport const frictionBackstopData = ${JSON.stringify(out)};\n`);
console.log(out.rows.map(r=>({hold:r.hold,length:r.length,seatedSamples:r.lifts.filter(v=>v===0).length,max:Math.max(...r.lifts)})),{k,toothOffset});
