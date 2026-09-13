import source from './source.js';
import {rotate,sub,capsule} from '../finite-plate-geometry.js';

export function makeQuickReturnProfile({segments=128}={}) {
  const world=p=>[(p[0]-source.axis[0])/100,(source.axis[1]-p[1])/100],pivot=world(source.pivot),sourceAngle=-source.slot[2];
  const local=p=>rotate(sub(world(p),pivot),-sourceAngle),center=local(source.slot),halfLength=source.slot[3]/100,halfWidth=source.slot[4]/100;
  const ends=[-1,1].map(sign=>[center[0]+sign*halfLength,center[1]]),pinRadius=source.pinRadius/100,clearance=halfWidth-pinRadius;
  const pin=world(source.pin),crankRadius=Math.hypot(...pin),phase=Math.atan2(pin[1],pin[0]),pivotDistance=Math.hypot(...pivot);
  // Initialization and diagnostics only: the wrist is on the negative-X side
  // of the lever pivot. Native contact, rather than this relation, drives it.
  const reference=(a,side=0)=>{
    const p=sub(rotate([crankRadius,0],a),pivot),r=Math.hypot(...p),y=center[1]+side*clearance;
    const q=Math.atan2(p[1],p[0])-Math.atan2(y,-Math.sqrt(r*r-y*y));return Math.atan2(Math.sin(q),Math.cos(q));
  };
  const tangentAngle=Math.asin(crankRadius/pivotDistance),quickReturnRatio=(Math.PI+2*tangentAngle)/(Math.PI-2*tangentAngle);
  return {segments,world,local,pivot,sourceAngle,center,halfLength,halfWidth,ends,pinRadius,clearance,crankRadius,phase,pivotDistance,reference,tangentAngle,quickReturnRatio,
    slot:capsule(...ends,halfWidth,segments)};
}
