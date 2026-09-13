import source from './source.js';
import {rotate,sub,capsule} from '../finite-plate-geometry.js';

export function makeSlottedBarProfile({segments=128}={}) {
  const world=p=>[(p[0]-source.axis[0])/100,(source.axis[1]-p[1])/100],sourceAngle=-source.slot[2],local=p=>rotate(world(p),-sourceAngle);
  const center=local(source.slot),halfLength=source.slot[3]/100,pinRadius=source.pinRadius/100;
  // The ink makes the wrist wider than the slot. Retain the measured wrist
  // and open each wall by 0.590 source pixel, including 0.2 pixel clearance.
  const clearance=.002,halfWidth=pinRadius+clearance,ends=[-1,1].map(s=>[center[0]+s*halfLength,center[1]]);
  const barY=world([source.axis[0],(source.barTop+source.barBottom)/2])[1],barHalfHeight=(source.barBottom-source.barTop)/200;
  const amplitude=sourceAngle+Math.PI/2;
  // Only initialization and geometric checks use this ideal centerline.
  const reference=(angle,side=0)=>(barY*Math.cos(angle)-center[1]-side*clearance)/Math.sin(angle);
  const initialX=reference(sourceAngle),minimumX=reference(-Math.PI/2-amplitude),barLeft=world([source.barEnds[0],0])[0]-initialX;
  const measuredRight=world([source.barEnds[1],0])[0]-initialX,guideRight=world([source.guides[1][1],0])[0];
  const barRight=Math.max(measuredRight,guideRight+.07-minimumX);
  return {segments,world,local,sourceAngle,center,halfLength,halfWidth,pinRadius,clearance,ends,slot:capsule(...ends,halfWidth,segments),
    barY,barHalfHeight,barLeft,barRight,amplitude,reference,initialX,minimumX,rightExtensionPixels:100*(barRight-measuredRight),
    slotWideningPixels:100*halfWidth-source.slot[4],initialPinShiftPixels:100*Math.hypot(...sub([initialX,barY],world(source.pin)))};
}
