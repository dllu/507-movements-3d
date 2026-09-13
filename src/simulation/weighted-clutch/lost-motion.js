// Promoted from scripts/lib/weighted-clutch-lost-motion.mjs; geometry parity is tested.
import source from './source.js';
import {makeWeightedClutchLinkage,toWeightedClutchWorld as world} from './linkage.js';

const subtract=(a,b)=>a.map((v,k)=>v-b[k]),length=p=>Math.hypot(...p),
 rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

// Keep both fulcrums, the weight and G's upper arm at their measured places.
// Move only the two rod pins along their existing arms. Positive adjustment
// shortens F's crank and lengthens G's crank by the same source-pixel amount.
// This is an explicit departure from Brown's proportions, not a new reading.
export function makeAdjustedWeightedClutchLinkage(pinAdjustmentPixels=0){
 if(!Number.isFinite(pinAdjustmentPixels))throw Error('Nonfinite pin adjustment');
 const measured=makeWeightedClutchLinkage().parameters,scale=source.scale,
  armF=measured.armF.map(v=>v*(1-pinAdjustmentPixels/scale/length(measured.armF))),
  armG=measured.armG.map(v=>v*(1+pinAdjustmentPixels/scale/length(measured.armG))),
  F=measured.F,G=measured.G,A0=armF.map((v,k)=>v+F[k]),B0=armG.map((v,k)=>v+G[k]),
  radiusG=length(armG),rodLength=length(subtract(B0,A0)),angleG0=Math.atan2(armG[1],armG[0]);
 if(!(length(measured.armF)>pinAdjustmentPixels/scale&&length(measured.armG)>-pinAdjustmentPixels/scale))throw Error('Nonpositive crank length');
 const atAngle=angle=>{
  if(!Number.isFinite(angle))throw Error('Nonfinite weighted lever angle');
  const A=rotate(armF,angle).map((v,k)=>v+F[k]),delta=subtract(A,G),distance=length(delta),
   along=(radiusG**2+distance**2-rodLength**2)/(2*distance),square=radiusG**2-along**2;
  if(!(distance>0)||square<0)throw Error('Adjusted four-bar is outside its reachable branch');
  const height=Math.sqrt(square),choices=[-1,1].map(sign=>[G[0]+delta[0]*along/distance-sign*delta[1]*height/distance,
   G[1]+delta[1]*along/distance+sign*delta[0]*height/distance]),B=choices.sort((a,b)=>a[1]-b[1])[0];
  return{leverAngle:angle,bellAngle:Math.atan2(B[1]-G[1],B[0]-G[0])-angleG0,
   rodAngle:Math.atan2(B[1]-A[1],B[0]-A[0]),A,B,weightAngle:measured.weightAngle+angle};
 };
 return{atAngle,parameters:{...measured,armF,armG,A0,B0,radiusG,rodLength,pinAdjustmentPixels}};
}

export function slotCircleClearance(point,radius,ring){
 let distance=Infinity,inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i],d=subtract(b,a),v=subtract(point,a),l2=d[0]**2+d[1]**2,
   t=l2>0?Math.max(0,Math.min(1,(v[0]*d[0]+v[1]*d[1])/l2)):0;
  distance=Math.min(distance,Math.hypot(v[0]-t*d[0],v[1]-t*d[1]));
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return(inside?distance:-distance)-radius;
}

// Hypothesis supported by period lost-motion clutch mechanisms: the quadrant
// rotates with F, and a pin on the coaxial clutch-shifting member traverses
// its curved slot. Its two stops leave F free to pass vertical before shifting.
export function makeWeightedClutchLostMotion(slotRing,{followerRadius=17/source.scale,shoeRadius=.0549,grooveHalf=.055}={}){
 const radius=source.quadrant.radius/source.scale,finiteRing=slotRing.map(p=>p.map(Math.fround)),
  point=a=>[radius*Math.cos(a),radius*Math.sin(a)],clearance=a=>slotCircleClearance(point(a),followerRadius+2e-8,finiteRing)-1e-6,
  a=source.quadrant.startDegrees*Math.PI/180,b=source.quadrant.endDegrees*Math.PI/180;
 function boundary(inside,outside){
  if(!(clearance(inside)>0&&clearance(outside)<0))throw Error('Slot stop is not bracketed');
  for(let i=0;i<60;i++){const mid=(inside+outside)/2;if(clearance(mid)>0)inside=mid;else outside=mid;}
  return(inside+outside)/2;
 }
 const lower=boundary(a,a-.02),upper=boundary(b,b+.02),
  F=world(source.lever.pivot.center),collar=subtract(world(source.shifter.collar),F),collarRadius=length(collar),collarAngle=Math.atan2(collar[1],collar[0]),
  stroke=(source.clutch.movingLeftFace-source.clutch.leftFace-source.clutch.jawHeight)/source.scale,
  forkClearance=grooveHalf-shoeRadius,shifterAtShift=x=>Math.acos((collar[0]+x)/collarRadius)-collarAngle,
  shifterRight=shifterAtShift(forkClearance),shifterLeft=shifterAtShift(-stroke-forkClearance),
  followerAngle=upper-shifterRight,leverLeft=followerAngle+shifterLeft-lower;
 if(!(forkClearance>0&&leverLeft>0))throw Error('Invalid lost-motion dimensions');
 const pose=(leverAngle,direction)=>{
  if(!Number.isFinite(leverAngle)||leverAngle<0||leverAngle>leverLeft)throw Error('Lever outside diagnostic stop range');
  if(!['leftward','rightward'].includes(direction))throw Error('Unknown shift direction');
  const shifterAngle=Math.max(shifterRight,Math.min(shifterLeft,direction==='leftward'?leverAngle+lower-followerAngle:leverAngle+upper-followerAngle)),
   collarShift=collarRadius*Math.cos(collarAngle+shifterAngle)-collar[0],
   clutchShift=direction==='leftward'?Math.min(0,collarShift+forkClearance):Math.max(-stroke,collarShift-forkClearance),
   relativeAngle=followerAngle+shifterAngle-leverAngle;
  return{leverAngle,quadrantAngle:leverAngle,shifterAngle,clutchShift,relativeAngle,direction,
   slotClearance:slotCircleClearance(point(relativeAngle),followerRadius+2e-8,finiteRing)};
 };
 return{pose,parameters:{radius,followerRadius,followerAngle,lower,upper,freeAngle:upper-lower,
  shoeRadius,grooveHalf,forkClearance,collar,stroke,shifterRight,shifterLeft,leverLeft,finiteRing}};
}
