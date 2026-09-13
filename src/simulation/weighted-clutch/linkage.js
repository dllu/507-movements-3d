// Promoted from scripts/lib/weighted-clutch-linkage.mjs; geometry parity is tested.
import source from './source.js';

export const toWeightedClutchWorld=([x,y])=>[(x-source.origin[0])/source.scale,(source.origin[1]-y)/source.scale];
const sub=(a,b)=>a.map((v,k)=>v-b[k]),length=p=>Math.hypot(...p),rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

// F and G are connected by a rigid rod at their measured pins. The lower
// circle-intersection branch is the one shown in Brown. No contact, gravity
// or clutch-shift law is prescribed here.
export function makeWeightedClutchLinkage(){
 const F=toWeightedClutchWorld(source.lever.pivot.center),G=toWeightedClutchWorld(source.bell.pivotPin.center),
  A0=toWeightedClutchWorld(source.lever.rodPin.center),B0=toWeightedClutchWorld(source.bell.rodPin.center),
  armF=sub(A0,F),armG=sub(B0,G),radiusG=length(armG),rodLength=length(sub(B0,A0)),angleG0=Math.atan2(armG[1],armG[0]),
  weight=toWeightedClutchWorld(source.lever.weight.center),weightAngle=Math.atan2(weight[1]-F[1],weight[0]-F[0]);
 const atAngle=angle=>{
  if(!Number.isFinite(angle))throw Error('Nonfinite weighted lever angle');
  const A=rotate(armF,angle).map((v,k)=>v+F[k]),delta=sub(A,G),distance=length(delta),along=(radiusG**2+distance**2-rodLength**2)/(2*distance),square=radiusG**2-along**2;
  if(!(distance>0)||square<0)throw Error('Measured four-bar is outside its reachable branch');
  const height=Math.sqrt(square),choices=[-1,1].map(sign=>[G[0]+delta[0]*along/distance-sign*delta[1]*height/distance,
   G[1]+delta[1]*along/distance+sign*delta[0]*height/distance]),B=choices.sort((a,b)=>a[1]-b[1])[0],
   bellAngle=Math.atan2(B[1]-G[1],B[0]-G[0])-angleG0,rodAngle=Math.atan2(B[1]-A[1],B[0]-A[0]);
  return{leverAngle:angle,bellAngle,rodAngle,A,B,weightAngle:weightAngle+angle};
 };
 return{atAngle,parameters:{F,G,A0,B0,armF,armG,radiusG,rodLength,weightAngle,overCenterAngle:Math.PI/2-weightAngle}};
}
