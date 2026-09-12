import source from './weighted-clutch-source.mjs';
import {makeWeightedClutchLinkage} from './weighted-clutch-linkage.mjs';

const measured=makeWeightedClutchLinkage().parameters,
 sub=(a,b)=>a.map((v,i)=>v-b[i]),length=p=>Math.hypot(...p),
 rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

// Source-pixel displacements use the image's downward-positive Y direction.
// All other measured points remain fixed. This is an explicit fitting family,
// not a reinterpretation of the two visible pin-center measurements.
export function makeWeightedClutchPinPlacement(displacementsPixels){
 if(!Array.isArray(displacementsPixels)||displacementsPixels.length!==2||
  displacementsPixels.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('Expected two finite pixel displacements');
 const [A0,B0]=[measured.A0,measured.B0].map((p,i)=>p.map((v,j)=>v+displacementsPixels[i][j]/source.scale*(j===0?1:-1))),
  F=measured.F,G=measured.G,armF=sub(A0,F),armG=sub(B0,G),radiusG=length(armG),rodLength=length(sub(B0,A0)),
  angleG0=Math.atan2(armG[1],armG[0]);
 if(!(length(armF)>0&&radiusG>0&&rodLength>0))throw Error('Nonpositive link length');
 const atAngle=leverAngle=>{
  if(!Number.isFinite(leverAngle))throw Error('Nonfinite weighted lever angle');
  const A=rotate(armF,leverAngle).map((v,i)=>v+F[i]),delta=sub(A,G),distance=length(delta),
   along=(radiusG**2+distance**2-rodLength**2)/(2*distance),square=radiusG**2-along**2;
  if(!(distance>0)||square<0)throw Error('Fitted four-bar is outside its reachable branch');
  const height=Math.sqrt(square),choices=[-1,1].map(sign=>[G[0]+delta[0]*along/distance-sign*delta[1]*height/distance,
   G[1]+delta[1]*along/distance+sign*delta[0]*height/distance]),B=choices.sort((a,b)=>a[1]-b[1])[0];
  return{leverAngle,A,B,bellAngle:Math.atan2(B[1]-G[1],B[0]-G[0])-angleG0,
   rodAngle:Math.atan2(B[1]-A[1],B[0]-A[0]),weightAngle:measured.weightAngle+leverAngle};
 };
 return{atAngle,parameters:{...measured,A0,B0,armF,armG,radiusG,rodLength,displacementsPixels,
  maximumPinDisplacement:Math.max(...displacementsPixels.map(length))}};
}
