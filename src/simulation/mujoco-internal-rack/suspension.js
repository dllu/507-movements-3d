import {internalRackPitchDimensions} from './profile.js';

// Parallel paired cranks reconcile the small left/right differences in the drawing.
// Coordinates are relative to the translating carriage, with a fixed pinion at 0.
export function internalRackSuspension(rackY){
 const sourceY=internalRackPitchDimensions().orbit;
 const pivot=[-1.60,1.01],rackPin=[-1.22,.675-sourceY+rackY];
 const wristVector=[.37,.24],topVector=[-.075,.58];
 const crankRadius=Math.hypot(...wristVector),rodLength=Math.hypot(.01,.575);
 const dx=rackPin[0]-pivot[0],dy=rackPin[1]-pivot[1],distance=Math.hypot(dx,dy);
 const a=(crankRadius**2-rodLength**2+distance**2)/(2*distance);
 const h2=crankRadius**2-a*a;
 if(h2<0)throw new RangeError('Suspension cannot reach the rack position');
 const h=Math.sqrt(h2),ux=dx/distance,uy=dy/distance;
 const wrist=[pivot[0]+a*ux-h*uy,pivot[1]+a*uy+h*ux];
 const angle=Math.atan2(wrist[1]-pivot[1],wrist[0]-pivot[0])-Math.atan2(wristVector[1],wristVector[0]);
 const c=Math.cos(angle),s=Math.sin(angle),top=[pivot[0]+c*topVector[0]-s*topVector[1],pivot[1]+s*topVector[0]+c*topVector[1]];
 const left={pivot,rackPin,wrist,top};
 const right=Object.fromEntries(Object.entries(left).map(([k,[x,y]])=>[k,[x+2.54,y]]));
 return {left,right,angle,crankRadius,rodLength,topRadius:Math.hypot(...topVector),couplerLength:2.54};
}
