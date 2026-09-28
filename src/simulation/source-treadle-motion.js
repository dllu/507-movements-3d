// Brown draws the crank pin well out on the disk, at (205,295): 0.85 of the
// disk radius, on the lower-left radial line. Pass 92 restores that throw (pass
// 59 had moved the pin in to 0.28 of the radius). The treadle now rocks through
// about 49 degrees, from just below level up across the disk face; it lies in
// its own layer in front of the disk and never comes within 0.53 of the pin.
export const sourceTreadleDimensions={diskCenter:[281,240],diskRadius:111,crankPin:[205,295],pivot:[421,418],joint:[181,412],foot:[78,410],scale:.014,period:4};
export function sourceTreadleParameters(source=sourceTreadleDimensions){
 const point=p=>[(p[0]-source.diskCenter[0])*source.scale,(source.diskCenter[1]-p[1])*source.scale];
 const pin=point(source.crankPin),pivot=point(source.pivot),joint=point(source.joint),foot=point(source.foot),arm=[joint[0]-pivot[0],joint[1]-pivot[1]],armLength=Math.hypot(...arm);
 return{pin,pivot,armLength,rodLength:Math.hypot(joint[0]-pin[0],joint[1]-pin[1]),footLength:((foot[0]-pivot[0])*arm[0]+(foot[1]-pivot[1])*arm[1])/armLength,restAngle:Math.atan2(arm[1],arm[0]),period:source.period};
}
export function sourceTreadleState(time,g=sourceTreadleParameters()){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Time must be finite and nonnegative');
 const diskAngle=2*Math.PI*time/g.period,c=Math.cos(diskAngle),s=Math.sin(diskAngle),pin=[g.pin[0]*c-g.pin[1]*s,g.pin[0]*s+g.pin[1]*c];
 const dx=g.pivot[0]-pin[0],dy=g.pivot[1]-pin[1],distance=Math.hypot(dx,dy);
 if(distance<=Math.abs(g.rodLength-g.armLength)||distance>=g.rodLength+g.armLength)throw new RangeError('Treadle linkage reaches or exceeds a toggle');
 const along=(g.rodLength**2-g.armLength**2+distance**2)/(2*distance),height=Math.sqrt(g.rodLength**2-along**2);
 const joint=[pin[0]+(along*dx+height*dy)/distance,pin[1]+(along*dy-height*dx)/distance];
 const raw=Math.atan2(joint[1]-g.pivot[1],joint[0]-g.pivot[0]),treadleAngle=g.restAngle+Math.atan2(Math.sin(raw-g.restAngle),Math.cos(raw-g.restAngle));
 const foot=[g.pivot[0]+g.footLength*Math.cos(treadleAngle),g.pivot[1]+g.footLength*Math.sin(treadleAngle)];
 return{time,diskAngle,pin,joint,foot,treadleAngle,rodAngle:Math.atan2(joint[1]-pin[1],joint[0]-pin[0])};
}
