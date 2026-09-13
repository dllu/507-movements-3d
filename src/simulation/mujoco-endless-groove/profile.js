import source from './source.js';
import {rotate,sub,capsule} from '../finite-plate-geometry.js';

export function makeEndlessGrooveProfile({segments=256,clearance=.0005}={}) {
  const world=p=>[(p[0]-source.axis[0])/100,(source.axis[1]-p[1])/100];
  const pivot=world(source.pivot),sourceAngle=-source.groove.angle;
  const local=p=>rotate(sub(world(p),pivot),-sourceAngle);
  const center=local(source.groove.center),halfLength=source.groove.halfLength/100;
  const [innerRadius,outerRadius]=source.groove.radii.map(r=>r/100),radius=(innerRadius+outerRadius)/2;
  const halfWidth=(outerRadius-innerRadius)/2,pinRadius=halfWidth-clearance;
  const ends=[-1,1].map(sign=>[center[0]+sign*halfLength,center[1]]);
  const pin=world(source.pin),crankRadius=Math.hypot(...pin),phase=Math.atan2(pin[1],pin[0]);
  const distance=p=>Math.hypot(Math.max(0,Math.abs(p[0]-center[0])-halfLength),p[1]-center[1]);
  // The source crank cannot reach either end of the closed groove. This root
  // describes its lower branch for initialization and independent diagnostics.
  // It never supplies the simulated output angle or velocity during playback.
  const reference=inputAngle=>{
    const relative=sub(rotate([crankRadius,0],inputAngle),pivot),length=Math.hypot(...relative);
    let low=0,high=1.3;
    for(let i=0;i<48;i++) {
      const a=(low+high)/2,p=[-length*Math.cos(a),-length*Math.sin(a)];
      if(distance(p)>radius)high=a;else low=a;
    }
    const a=(low+high)/2,theta=Math.atan2(relative[1],relative[0])-Math.atan2(-Math.sin(a),-Math.cos(a));
    return Math.atan2(Math.sin(theta),Math.cos(theta));
  };
  return {segments,clearance,world,local,pivot,center,halfLength,innerRadius,outerRadius,radius,halfWidth,pinRadius,ends,
    crankRadius,phase,sourceAngle,distance,reference,
    inner:capsule(...ends,innerRadius,segments),outer:capsule(...ends,outerRadius,segments)};
}
