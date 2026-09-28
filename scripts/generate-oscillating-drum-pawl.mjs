// Offline design and lift table for movement 360's drum-mounted pawl.
// The pawl is one flat bored link whose chisel nose lies along the ratchet's
// radial driving face and the back of the tooth behind it, so while it
// drives it sits in the root. The lift table is the least pawl rotation that
// keeps the finite outline clear of the finite ratchet, as a function of the
// relative tooth phase: during overrun the pawl rides each tooth back and
// drops into the next root as the tooth corner passes, and the flywheel's
// further run past that drop is the backlash that lets it seat before the
// drum catches up with the face. No force integration.
import fs from 'node:fs';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {drumContact as p} from '../src/simulation/oscillating-drum-contact.js';
const rot=(q,a)=>[q[0]*Math.cos(a)-q[1]*Math.sin(a),q[0]*Math.sin(a)+q[1]*Math.cos(a)];
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
const area=mp=>mp.reduce((s,polygon)=>s+polygon.reduce((t,ring,k)=>{let A=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)A+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return t+(k?-1:1)*Math.abs(A/2);},0),0);
const face=p.lockPhase,P=p.pivot,pitch=p.pitch,root=p.rootRadius,tip=p.tipRadius;
const width=.085,halfWidth=width/2,noseClearance=.002,faceGap=0;
// Brown's pawl is a hook: an eye on the pin and a body that bows outward
// (away from the ratchet) as it curves down into the teeth. The body is a
// constant-width circular-arc band whose inner edge passes through the nose
// vertex A; bulge is the arc's sagitta as a fraction of the chord.
const bulge=.20;
const A=polar(root+noseClearance,face-noseClearance/root);
// The drum pivot trails the face and lies well outside the teeth, so the
// link meets the root almost along the back of the tooth behind: its
// underside runs straight from the nose vertex A (parallel to the link axis)
// and clears that tooth back, and the working face squares off the nose.
let axis=Math.atan2(A[1]-P[1],A[0]-P[0]);
for(let i=0;i<20;i++){const out=[-Math.sin(axis),Math.cos(axis)];const s=(out[0]*A[0]+out[1]*A[1]>0)?1:-1;const C=[A[0]+s*halfWidth*out[0],A[1]+s*halfWidth*out[1]];axis=Math.atan2(C[1]-P[1],C[0]-P[0]);}
const base=axis,length=Math.hypot(A[0]-P[0],A[1]-P[1]);
const toLocal=q=>rot([q[0]-P[0],q[1]-P[1]],-base);
const radial=[Math.cos(face),Math.sin(face)];
let back=[-Math.cos(base),-Math.sin(base)];
// The seated clearance check below confirms that this underside clears the tooth back.
const big=2,side=(through,dir,s)=>{const n=[-dir[1]*s,dir[0]*s];return[[through[0]+big*dir[0],through[1]+big*dir[1]],[through[0]+big*dir[0]-big*n[0],through[1]+big*dir[1]-big*n[1]],[through[0]-big*dir[0]-big*n[0],through[1]-big*dir[1]-big*n[1]],[through[0]-big*dir[0],through[1]-big*dir[1]]];};
const choose=(through,dir,test)=>{for(const s of[1,-1]){const h=side(through,dir,s),box=[[test[0]-1e-3,test[1]-1e-3],[test[0]+1e-3,test[1]-1e-3],[test[0]+1e-3,test[1]+1e-3],[test[0]-1e-3,test[1]+1e-3]];if(area(clip.intersection([h],[box]))>1e-7)return h;}throw Error('half-plane');};
// Working face exactly on the radial driving face (faceGap), back relieved.
const faceThrough=polar(root,face-faceGap/root);
const faceHalf=choose(faceThrough,radial,polar(root+.05,face-.06));
const backHalf=choose(A,back,polar(tip+.03,face-.02));
// Arc through P and the band centreline point C beside A (iterated so the
// band's edge passes through A). The arc bows away from the ratchet centre.
let C=A.slice(),arc;
for(let it=0;it<40;it++){
 const d=[C[0]-P[0],C[1]-P[1]],L=Math.hypot(...d),m=[(P[0]+C[0])/2,(P[1]+C[1])/2];
 let q=[-d[1]/L,d[0]/L];if(q[0]*m[0]+q[1]*m[1]<0)q=[-q[0],-q[1]]; // q points outward
 const sag=bulge*L,R=(L*L/4+sag*sag)/(2*sag),O=[m[0]-q[0]*(R-sag),m[1]-q[1]*(R-sag)];
 arc={O,R};
 // Radial of A from O; the band spans R-halfWidth..R+halfWidth, so A sits on
 // whichever edge is nearer and C is A moved to the centreline.
 const ra=Math.hypot(A[0]-O[0],A[1]-O[1]),dir=[(A[0]-O[0])/ra,(A[1]-O[1])/ra];
 const target=ra+halfWidth; // A on the inner edge, the band outside it
 const Cn=[O[0]+dir[0]*target,O[1]+dir[1]*target];
 if(Math.hypot(Cn[0]-C[0],Cn[1]-C[1])<1e-12){C=Cn;break;}C=Cn;
}
{const {O,R}=arc,aP=Math.atan2(P[1]-O[1],P[0]-O[0]),aC=Math.atan2(C[1]-O[1],C[0]-O[0]);
 let sweep=aC-aP;while(sweep>Math.PI)sweep-=2*Math.PI;while(sweep<-Math.PI)sweep+=2*Math.PI;
 // Tangent at A along the arc back towards P: the underside runs this way.
 const sgn=Math.sign(sweep);back=[sgn*Math.sin(aC),-sgn*Math.cos(aC)];
 arc.aP=aP;arc.sweep=sweep;}
const bandPoints=(extra)=>{const {O,R,aP,sweep}=arc,N=96,out=[],inn=[];
 const a0=aP-Math.sign(sweep)*.02,a1=aP+sweep+Math.sign(sweep)*extra;
 for(let i=0;i<=N;i++){const a=a0+(a1-a0)*i/N;out.push([O[0]+(R+halfWidth)*Math.cos(a),O[1]+(R+halfWidth)*Math.sin(a)]);inn.push([O[0]+(R-halfWidth)*Math.cos(a),O[1]+(R-halfWidth)*Math.sin(a)]);}
 return [...out,...inn.reverse()];};
const backHalf2=choose(A,back,polar(tip+.03,face-.02));
// The hooked nose stops on the root circle (plus clearance) instead of
// curling below it.
const clearDisk=[Array.from({length:384},(_,i)=>polar(root+noseClearance,2*Math.PI*i/384))];
const body=clip.difference(clip.intersection([bandPoints(.12/arc.R)],[faceHalf]),clearDisk);
if(body.length!==1)throw Error('pawl body not one piece');
const outline=body[0][0].slice(0,-1).map(toLocal).map(q=>q.map(v=>+v.toFixed(9)));
const rootDisk=Array.from({length:192},(_,i)=>polar(root,2*Math.PI*i/192));
function ratchetAt(angle,near){const out=[[rootDisk]];const j0=Math.round((near-angle)/pitch);for(let j=j0-2;j<=j0+2;j++)out.push([p.profile.map(q=>rot(q,angle+j*pitch))]);return out;}
const pawlAt=lift=>[outline.map(q=>{const r=rot(q,base-lift);return[r[0]+P[0],r[1]+P[1]];})];
const hits=(lift,angle)=>{const pawl=pawlAt(lift);for(const part of ratchetAt(angle,face))if(area(clip.intersection([pawl],part))>1e-9)return true;return false;};
// Positive lift must raise the nose away from the axis.
{const nearest=poly=>Math.min(...poly[0].map(q=>Math.hypot(...q)));if(nearest(pawlAt(.05))<=nearest(pawlAt(0)))throw Error('lift sign');}
if(hits(0,face))throw Error('pawl not clear when seated');
const count=512;
// Relative tooth phase s: the ratchet stands at face + s*pitch relative to the drum.
const lifts=Array.from({length:count},(_,s)=>{const angle=face+pitch*s/count;if(!hits(0,angle))return 0;let lo=0,hi=.02;while(hits(hi,angle)){lo=hi;hi+=.02;if(hi>1)throw Error('no clear lift');}for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(hits(mid,angle))lo=mid;else hi=mid;}return +(hi+.0005).toFixed(9);});
const out={count,base:+base.toFixed(12),length:+length.toFixed(12),width,outline,lifts};
fs.writeFileSync(new URL('../src/simulation/oscillating-drum-pawl-data.js',import.meta.url),`// Generated by scripts/generate-oscillating-drum-pawl.mjs: movement 360's finite pawl\n// outline and least-clearance lift against relative tooth phase.\nexport const drumPawl=${JSON.stringify(out)};\n`);
console.log({length,base,seated:lifts.filter(v=>v===0).length,max:Math.max(...lifts),outline});
