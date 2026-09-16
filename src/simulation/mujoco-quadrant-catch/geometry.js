import * as THREE from 'three';
import {poly,circle,sector,rotate,polygonClipping as clip} from '../finite-plate-geometry.js';

export const quadrantSource={
 origin:[279,241],scale:.0125,
 upper:{pivots:[[275,129],[277,96]],tips:[[209,298],[84,145]],weights:[[400,45],[377,201]]},
 lower:{pivots:[[283,353],[281,320]],tips:[[74,313],[213,154]],weights:[[142,421],[181,238]]},
};
const relative=(p,o)=>[(p[0]-o[0])*.0125,(o[1]-p[1])*.0125];
const distance2=(a,b)=>a.reduce((s,v,i)=>s+(v-b[i])**2,0);
export function fitQuadrantHandle(side){
 const source=quadrantSource[side],pivot=relative(source.pivots[0],quadrantSource.origin);
 const tips=source.tips.map((p,i)=>relative(p,source.pivots[i])),weights=source.weights.map((p,i)=>relative(p,source.pivots[i]));
 const shoeRight=(190-279)*.0125,tipRadius=.1,minimumClosedX=shoeRight+tipRadius+.025-pivot[0];
 let best;
 for(let i=0;i<=10000;i++){
  const angle=-.6-i*.0001,mean=pair=>{const p=rotate(pair[1],-angle);return pair[0].map((v,j)=>(v+p[j])/2);};
  const tip=mean(tips),weight=mean(weights),closedAngle=side==='upper'?0:angle,closed=rotate(tip,closedAngle);
  if(closed[0]<minimumClosedX){const correction=rotate([minimumClosedX-closed[0],0],-closedAngle);tip[0]+=correction[0];tip[1]+=correction[1];}
  const errors=[distance2(tip,tips[0]),distance2(rotate(tip,angle),tips[1]),distance2(weight,weights[0]),distance2(rotate(weight,angle),weights[1])];
  const score=errors.reduce((s,v)=>s+v,0);
  if(!best||score<best.score)best={angle,tip,weight,score,errorsPixels:errors.map(v=>Math.sqrt(v)/.0125)};
 }
 return {...best,side,pivot,tipRadius,shoeRight,source};
}
function workingOutline(side,fit){
 const source=side==='upper'
  ?[[277,96],[255,109],[238,130],[215,142],[184,145],[148,145],[112,145],[84,145]]
  :[[283,353],[260,342],[236,328],[211,316],[177,313],[140,312],[103,312],[74,313]];
 const pivot=fit.source.pivots[side==='upper'?1:0],angle=side==='upper'?-fit.angle:0;
 const raw=source.map(p=>rotate(relative(p,pivot),angle)),tip=raw.at(-1);
 const rotation=Math.atan2(fit.tip[1],fit.tip[0])-Math.atan2(tip[1],tip[0]),scale=Math.hypot(...fit.tip)/Math.hypot(...tip);
 const curve=new THREE.SplineCurve(raw.map(p=>new THREE.Vector2(...rotate(p,rotation).map(v=>v*scale)))),left=[],right=[];
 for(let i=0;i<=96;i++){
  const t=i/96,p=curve.getPoint(t),n=curve.getTangent(t).normalize(),width=.095+.095*(1-t)**2;
  left.push([p.x-n.y*width,p.y+n.x*width]);right.push([p.x+n.y*width,p.y-n.x*width]);
 }
 const outline=clip.union(poly([...left,...right.reverse()]),poly(circle(fit.tip,fit.tipRadius,64)));
 return clip.difference(outline,poly(circle([0,0],.12,64)));
}

// The narrow circular rims follow the engraved radii. Axial pins on the
// opposite handles are inferred where the drawings obscure the retention.
export function quadrantGeometry({releaseLead=.04,pinRadius=.07}={}){
 const upper=fitQuadrantHandle('upper'),lower=fitQuadrantHandle('lower');
 const bands={upper:{inner:1.375,outer:1.75,start:-.95,end:.62},lower:{inner:1.35,outer:1.68,start:.94,end:2.287}};
 const bottomAngle=bands.lower.end+lower.angle+releaseLead,topAngle=bands.upper.start-releaseLead;
 const upperPin=bands.lower.outer+pinRadius+.0004,lowerPin=bands.upper.outer+pinRadius+.0004;
 const upperPinLocal=rotate([upperPin,0],bottomAngle).map((v,i)=>v+lower.pivot[i]-upper.pivot[i]);
 const lowerHeldPin=rotate([lowerPin,0],topAngle).map((v,i)=>v+upper.pivot[i]-lower.pivot[i]);
 const lowerPinLocal=rotate(lowerHeldPin,-lower.angle);
 const handles={};for(const [side,fit,pin]of [['upper',upper,upperPinLocal],['lower',lower,lowerPinLocal]]){
  const band=bands[side];handles[side]={fit,pin,band,working:workingOutline(side,fit),quadrant:sector(band.inner,band.outer,band.start,band.end,80)};
 }
 return {handles,pinRadius,releaseLead,period:18,shoe:{left:(169-279)*.0125,right:(190-279)*.0125,halfHeight:.275},
  start:(241-352)*.0125,end:(208-105)*.0125,source:quadrantSource};
}
