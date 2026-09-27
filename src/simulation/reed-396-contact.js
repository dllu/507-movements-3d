// Dimensionless finite reconstruction. Pure geometry shared by the offline
// continuation and its independent rendered-solid tests; no live contact solve.
export const reed396 = Object.freeze({pitch: Math.PI / 6, period: 4, leverAmplitude: Math.PI / 36, balanceAmplitude: 2 * Math.PI / 3, freeDropSpeed: .5, pinOrbit: .5, balanceCenter: -2.34, leverPivot: 2.18, jOffset: -.855});
// jOffset: chronometer pallet j stands .855 rad behind roller pin i on staff b,
// so that, as the fork pin releases detent f, j is already past the line of
// centres where the released tooth drives it forward (the direct impulse).
export const rotate396 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const add = (a,b) => a.map((x,i)=>x+b[i]), sub = (a,b) => a.map((x,i)=>x-b[i]);
export function reed396Profiles() {
 const wheel=[], teeth=[], pallets={};
 for(let i=0;i<12;i++){
  for(const [o,r] of [[-.5,1.43],[-.1,1.43],[0,1.72],[.15,1.43],[.5,1.43]])wheel.push(rotate396([r,0],(i+o)*reed396.pitch));
  teeth.push([rotate396([1.43,0],(i-.1)*reed396.pitch),rotate396([1.72,0],i*reed396.pitch),rotate396([1.43,0],(i+.15)*reed396.pitch)]);
 }
 for(const [name,a,bank]of [['G',Math.PI/8,reed396.leverAmplitude],['F',-Math.PI/8,-reed396.leverAmplitude]]){
  const q=rotate396([1.72,0],a),n=rotate396([-1/Math.hypot(1,.6),.6/Math.hypot(1,.6)],a),t=[n[1],-n[0]];
  pallets[name]=[[-.02,0],[.07,0],[.07,-.10],[-.02,-.10]].map(([u,v])=>rotate396(sub(add(q,add(t.map(x=>x*u),n.map(x=>x*v))),[2.18,0]),-bank));
 }
 pallets.J=[[.48,-.09],[.658,-.09],[.658,-.025],[.48,-.025]];
 return {wheel,teeth,pallets};
}
// Lever C follows roller pin i while the pin is in fork e (the slot runs
// along the lever through staff c), and rests on a banking pin l otherwise.
// The pin orbit is chosen so the pin carries the lever exactly bank to bank.
const slotAngle=beta=>Math.atan2(-reed396.pinOrbit*Math.sin(beta),reed396.leverPivot-reed396.balanceCenter-reed396.pinOrbit*Math.cos(beta));
export const reed396EngageAngle=(()=>{let a=0,b=Math.PI/2;for(let i=0;i<80;i++){const m=(a+b)/2;if(slotAngle(m)>-reed396.leverAmplitude)a=m;else b=m;}return (a+b)/2;})();
export function reed396LeverFromBalance(beta){
 if(Math.abs(beta)>=reed396EngageAngle)return {angle:-Math.sign(beta)*reed396.leverAmplitude,slope:0,engaged:false};
 const h=1e-6;return {angle:slotAngle(beta),slope:(slotAngle(beta+h)-slotAngle(beta-h))/(2*h),engaged:true};
}
export function reed396Pose(time){
 const half=Math.floor(time/2),phase=time/2-half,side=((half%2)+2)%2===0?1:-1;
 const balanceAngle=-side*reed396.balanceAmplitude*Math.cos(Math.PI*phase),balanceAngularSpeed=side*reed396.balanceAmplitude*Math.PI/2*Math.sin(Math.PI*phase);
 const lever=reed396LeverFromBalance(balanceAngle);
 return {balanceAngle,balanceAngularSpeed,balanceAcceleration:side*reed396.balanceAmplitude*(Math.PI/2)**2*Math.cos(Math.PI*phase),leverAngle:lever.angle,leverAngularSpeed:lever.slope*balanceAngularSpeed,forkEngaged:lever.engaged};
}
export function reed396Obstacles(pose,pallets=reed396Profiles().pallets){
 return ['G','F','J'].map(name=>pallets[name].map(q=>add(rotate396(q,name==='J'?pose.balanceAngle+reed396.jOffset:pose.leverAngle),name==='J'?[-2.34,0]:[2.18,0])));
}
export function reed396ConvexGap(A,B){
 let gap=-Infinity,normal;
 for(const P of[A,B])for(let i=0;i<P.length;i++){
  const e=sub(P[(i+1)%P.length],P[i]),L=Math.hypot(...e),n=[-e[1]/L,e[0]/L];
  const pa=A.map(q=>q[0]*n[0]+q[1]*n[1]),pb=B.map(q=>q[0]*n[0]+q[1]*n[1]);
  for(const [value,sign]of[[Math.min(...pa)-Math.max(...pb),1],[Math.min(...pb)-Math.max(...pa),-1]])if(value>gap){gap=value;normal=n.map(x=>x*sign);}
 }
 return {gap,normal};
}
export function reed396Contact(angle,obstacles,teeth=reed396Profiles().teeth){
 let result={gap:Infinity};
 for(let i=0;i<teeth.length;i++){
  const tri=teeth[i].map(q=>rotate396(q,angle));
  for(let j=0;j<obstacles.length;j++){
   const c=reed396ConvexGap(tri,obstacles[j]);
   if(c.gap<result.gap){const dots=tri.map(q=>q[0]*c.normal[0]+q[1]*c.normal[1]),k=dots.indexOf(Math.min(...dots));result={...c,pallet:j,tooth:i,point:tri[k]};}
  }
 }
 return result;
}
