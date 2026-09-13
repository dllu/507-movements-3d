import source from './source.js';
import {rotate,sub,add,capsule} from '../finite-plate-geometry.js';

export function makeEndlessGrooveProfile({segments=256,clearance=.0005}={}) {
  const world=p=>[(p[0]-source.axis[0])/100,(source.axis[1]-p[1])/100];
  const pivot=world(source.pivot),sourceAngle=-source.groove.angle;
  const local=p=>rotate(sub(world(p),pivot),-sourceAngle);
  const center=local(source.groove.center),halfLength=source.groove.halfLength/100;
  const [innerRadius,outerRadius]=source.groove.radii.map(r=>r/100),radius=(innerRadius+outerRadius)/2;
  const halfWidth=(outerRadius-innerRadius)/2,pinRadius=halfWidth-clearance;
  const ends=[-1,1].map(sign=>[center[0]+sign*halfLength,center[1]]);
  const pin=world(source.pin),radialEnds=ends.map(p=>Math.hypot(...p));
  const minimumRadius=Math.min(...radialEnds)-radius,maximumRadius=Math.max(...radialEnds)+radius;
  // Both extrema must agree with the crank's distances from the arm pivot.
  // Otherwise the two sides of the closed groove are disconnected assemblies.
  const pivotDistance=(minimumRadius+maximumRadius)/2,crankRadius=(maximumRadius-minimumRadius)/2;
  const originalPivotDistance=Math.hypot(...pivot),inputCenter=pivot.map(v=>v*(1-pivotDistance/originalPivotDistance));
  const line=add(pivot,rotate([center[0],center[1]-radius],sourceAngle)),direction=rotate([1,0],sourceAngle),relative=sub(line,inputCenter);
  const projection=relative.reduce((s,v,i)=>s+v*direction[i],0),discriminant=projection*projection-(relative.reduce((s,v)=>s+v*v,0)-crankRadius*crankRadius);
  const candidates=[-1,1].map(sign=>-projection+sign*Math.sqrt(discriminant)).filter(x=>Math.abs(x)<=halfLength)
    .map(x=>add(line,direction.map(v=>v*x)));
  for(const [i,end] of ends.entries()) {
    const cap=add(pivot,rotate(end,sourceAngle)),delta=sub(cap,inputCenter),d=Math.hypot(...delta),unit=delta.map(v=>v/d);
    const along=(crankRadius*crankRadius-radius*radius+d*d)/(2*d),across=Math.sqrt(crankRadius*crankRadius-along*along);
    for(const sign of [-1,1]) {
      const point=add(inputCenter,[along*unit[0]-sign*across*unit[1],along*unit[1]+sign*across*unit[0]]),p=rotate(sub(point,pivot),-sourceAngle);
      if(Number.isFinite(point[0])&&(i===0?p[0]<=end[0]:p[0]>=end[0]))candidates.push(point);
    }
  }
  candidates.sort((a,b)=>Math.hypot(...sub(a,pin))-Math.hypot(...sub(b,pin)));
  const initialPin=candidates[0],initialAngle=sourceAngle,phase=Math.atan2(initialPin[1]-inputCenter[1],initialPin[0]-inputCenter[0]);
  const initialLocal=rotate(sub(initialPin,pivot),-initialAngle),inputDerivative=rotate([-crankRadius*Math.sin(phase),crankRadius*Math.cos(phase)],-initialAngle);
  const normal=[initialLocal[0]-Math.max(ends[0][0],Math.min(ends[1][0],initialLocal[0])),initialLocal[1]-center[1]];
  const initialDerivative=(normal[0]*inputDerivative[0]+normal[1]*inputDerivative[1])/(-normal[0]*initialLocal[1]+normal[1]*initialLocal[0]);
  const distance=p=>Math.hypot(Math.max(0,Math.abs(p[0]-center[0])-halfLength),p[1]-center[1]);
  return {segments,clearance,world,local,pivot,center,halfLength,innerRadius,outerRadius,radius,halfWidth,pinRadius,ends,
    crankRadius,phase,sourceAngle,distance,inputCenter,initialPin,initialAngle,initialDerivative,minimumRadius,maximumRadius,pivotDistance,
    inner:capsule(...ends,innerRadius,segments),outer:capsule(...ends,outerRadius,segments)};
}
