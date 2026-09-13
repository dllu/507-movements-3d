// Promoted from scripts/lib/weighted-clutch-source-fit.mjs; geometry parity is tested.
import source from './source.js';
import {toWeightedClutchWorld as world} from './linkage.js';

const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(p,s)=>p.map(x=>x*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],length=p=>Math.hypot(...p);
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

export const weightedClutchFitPoints={
  F:source.lever.pivot.center,A:source.lever.rodPin.center,
  G:source.bell.pivotPin.center,B:source.bell.rodPin.center,
  upper:source.bell.upperEnd,E:source.wheelE.hub.center,stud:source.wheelE.stud.center,
};

// Explicit source-pixel fitting family. E moves only horizontally so the
// output shaft remains horizontal; the stud radius, weight, slot arc, clutch
// stroke and gear dimensions retain their previous measured values.
export function makeWeightedClutchSourceFit(shifts,freeAngle){
  const pixels={},points={};
  for(const[name,p]of Object.entries(weightedClutchFitPoints)){
    const delta=shifts[name]??[0,0];
    if(delta.length!==2||!delta.every(Number.isFinite))throw Error('Invalid source fit '+name);
    if(name==='E'&&delta[1]!==0)throw Error('E fit must preserve the horizontal shaft axis');
    pixels[name]=add(p,delta);points[name]=world(pixels[name]);
  }
  const {F,A:A0,G,B:B0,E,upper,stud}=points,armF=sub(A0,F),armG=sub(B0,G),
    radiusG=length(armG),rodLength=length(sub(B0,A0)),angleG0=Math.atan2(armG[1],armG[0]),
    weight=sub(world(source.lever.weight.center),F),weightAngle=Math.atan2(weight[1],weight[0]),
    collar=sub(world(source.shifter.collar),F),collarRadius=length(collar),collarAngle=Math.atan2(collar[1],collar[0]),
    forkClearance=.055-.0549,stroke=(source.clutch.movingLeftFace-source.clutch.leftFace-source.clutch.jawHeight)/source.scale,
    shifterRight=Math.acos((collar[0]+forkClearance)/collarRadius)-collarAngle,
    shifterLeft=Math.acos((collar[0]-stroke-forkClearance)/collarRadius)-collarAngle,
    leverLeft=freeAngle+shifterLeft-shifterRight,
    tip=sub(world(source.lever.tip),F),pinDistanceFromLeverLine=Math.abs(cross(armF,tip))/length(tip),
    pinEdgeMaterial=source.lever.halfWidth/source.scale-.058-pinDistanceFromLeverLine;
  if(!(radiusG>0&&rodLength>0&&length(armF)>0&&Number.isFinite(leverLeft)))throw Error('Degenerate source fit');
  function atAngle(leverAngle){
    const A=add(F,rotate(armF,leverAngle)),delta=sub(A,G),distance=length(delta),
      along=(radiusG**2+distance**2-rodLength**2)/(2*distance),square=radiusG**2-along**2;
    if(!(distance>0&&square>=0))throw Error('Fitted four-bar is outside its branch');
    const height=Math.sqrt(square),choices=[-1,1].map(sign=>[
      G[0]+delta[0]*along/distance-sign*delta[1]*height/distance,
      G[1]+delta[1]*along/distance+sign*delta[0]*height/distance]),
      B=choices.sort((a,b)=>a[1]-b[1])[0],rod=sub(B,A),denominator=cross(sub(B,G),rod),
      beta=cross(sub(A,F),rod)/denominator;
    if(!Number.isFinite(beta))throw Error('Fitted linkage is at a toggle');
    return {leverAngle,A,B,bellAngle:Math.atan2(B[1]-G[1],B[0]-G[0])-angleG0,
      rodAngle:Math.atan2(B[1]-A[1],B[0]-A[0]),weightAngle:weightAngle+leverAngle,beta,denominator};
  }
  return {atAngle,parameters:{...points,A0,B0,armF,armG,radiusG,rodLength,weightAngle,
    overCenterAngle:Math.PI/2-weightAngle,leverLeft,freeAngle,shifterLeft,shifterRight,
    upper0:sub(upper,G),orbit:length(sub(stud,E)),studOffset:sub(stud,E),
    barRadius:source.bell.upperHalfWidth/source.scale,studRadius:source.wheelE.stud.radius/source.scale,
    pixels,shifts,pinEdgeMaterial,maximumDisplacement:Math.max(...Object.keys(points).map(name=>length(shifts[name]??[0,0])))}};
}

// Generalized version of the earlier exact circle/capsule screen. Both finite
// ends remain present. The native rendered polygons require a later check.
export function sourceFitStudContacts(linkage,leverAngle){
  const L=linkage.parameters,state=linkage.atAngle(leverAngle),{G,E,orbit,barRadius,studRadius}=L,
    upper=rotate(L.upper0,state.bellAngle),end=add(G,upper),barLength=length(upper),
    tangent=mul(upper,1/barLength),normal=[-tangent[1],tangent[0]],R=barRadius+studRadius,
    contacts=[],tolerance=1e-10;
  const nearest=p=>add(G,mul(tangent,Math.max(0,Math.min(barLength,dot(sub(p,G),tangent)))));
  function candidate(p,feature){
    const close=nearest(p),delta=sub(p,close),distance=length(delta);
    if(Math.abs(distance-R)>tolerance||contacts.some(c=>length(sub(c.stud,p))<1e-9))return;
    const outward=mul(delta,1/distance),forceOnG=mul(outward,-1),pointOnG=add(close,mul(outward,barRadius)),
      theta=Math.atan2(p[1]-E[1],p[0]-E[0]),derivativeE=cross(sub(p,E),outward),
      torqueG=cross(sub(pointOnG,G),forceOnG);
    contacts.push({feature,theta,stud:p,pointOnG,forceOnG,torqueG,derivativeE,
      torqueF:torqueG*state.beta,approachCCW:derivativeE<0,approachCW:derivativeE>0});
  }
  for(const side of [-1,1]){
    const base=add(G,mul(normal,side*R)),delta=sub(base,E),b=dot(delta,tangent),
      c=dot(delta,delta)-orbit**2,discriminant=b*b-c;
    if(discriminant<0)continue;
    for(const t of [-b-Math.sqrt(discriminant),-b+Math.sqrt(discriminant)])
      if(t>=-tolerance&&t<=barLength+tolerance)candidate(add(base,mul(tangent,t)),'side'+side);
  }
  for(const[center,feature]of [[G,'pivot-cap'],[end,'tip-cap']]){
    const delta=sub(center,E),distance=length(delta),along=(orbit**2+distance**2-R*R)/(2*distance),square=orbit**2-along**2;
    if(!(distance>0)||square<0)continue;
    const height=Math.sqrt(square),unit=mul(delta,1/distance),n=[-unit[1],unit[0]];
    for(const sign of [-1,1]){
      const p=add(add(E,mul(unit,along)),mul(n,sign*height)),projection=dot(sub(p,center),tangent);
      if(feature==='pivot-cap'?projection<=tolerance:projection>=-tolerance)candidate(p,feature);
    }
  }
  return {leverAngle,bellAngle:state.bellAngle,beta:state.beta,barLength,orbit,barRadius,studRadius,
    radialGap:length(sub(E,nearest(E)))-orbit-R,contacts:contacts.sort((a,b)=>a.theta-b.theta)};
}

export function sourceFitBranchMargins(linkage,intervals=16){
  const L=linkage.parameters;let forward=Infinity,returning=Infinity,maximumBeta=-Infinity,minimumToggleDistance=Infinity;
  for(const direction of ['CCW','CW'])for(let i=0;i<=intervals;i++){
    const q=direction==='CCW'?L.overCenterAngle*i/intervals:
      L.overCenterAngle+(L.leverLeft-L.overCenterAngle)*i/intervals,
      r=sourceFitStudContacts(linkage,q),contacts=r.contacts.filter(c=>c['approach'+direction]),
      margin=contacts.length?Math.min(...contacts.map(c=>direction==='CCW'?c.torqueF:-c.torqueF)):-2;
    if(direction==='CCW')forward=Math.min(forward,margin);else returning=Math.min(returning,margin);
    maximumBeta=Math.max(maximumBeta,r.beta);
    minimumToggleDistance=Math.min(minimumToggleDistance,Math.abs(linkage.atAngle(q).denominator));
  }
  return {forward,returning,maximumBeta,minimumToggleDistance};
}
