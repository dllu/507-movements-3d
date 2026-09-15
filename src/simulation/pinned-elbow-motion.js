// Image coordinates, before any correction for a full-turn four-bar assembly.
export const pinnedElbowSource={diskCenter:[136,273],diskRadius:117,crankPin:[57,220],pivot:[343,265],input:[328,134],output:[468,265],rodLength:250,guideX:468,scale:.014,period:4};
export function pinnedElbowParameters(source=pinnedElbowSource){
 const point=p=>[(p[0]-source.diskCenter[0])*source.scale,(source.diskCenter[1]-p[1])*source.scale];
 const pin=point(source.crankPin),pivot=point(source.pivot),input=point(source.input),output=point(source.output);
 const restAngle=Math.atan2(input[1]-pivot[1],input[0]-pivot[0]);
 return{pin,pivot,restAngle,inputLength:Math.hypot(input[0]-pivot[0],input[1]-pivot[1]),couplerLength:Math.hypot(input[0]-pin[0],input[1]-pin[1]),outputLength:Math.hypot(output[0]-pivot[0],output[1]-pivot[1]),includedAngle:Math.atan2(output[1]-pivot[1],output[0]-pivot[0])-restAngle,rodLength:source.rodLength*source.scale,guideX:point([source.guideX,source.diskCenter[1]])[0],period:source.period};
}
export function pinnedElbowState(time,g){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Time must be finite and nonnegative');
 const driverAngle=2*Math.PI*time/g.period,c=Math.cos(driverAngle),s=Math.sin(driverAngle),pin=[g.pin[0]*c-g.pin[1]*s,g.pin[0]*s+g.pin[1]*c];
 const dx=g.pivot[0]-pin[0],dy=g.pivot[1]-pin[1],distance=Math.hypot(dx,dy);
 if(distance<=Math.abs(g.couplerLength-g.inputLength)||distance>=g.couplerLength+g.inputLength)throw new RangeError('Four-bar reaches or exceeds a toggle');
 const along=(g.couplerLength**2-g.inputLength**2+distance**2)/(2*distance),height=Math.sqrt(g.couplerLength**2-along**2);
 const input=[pin[0]+(along*dx-height*dy)/distance,pin[1]+(along*dy+height*dx)/distance];
 const rawAngle=Math.atan2(input[1]-g.pivot[1],input[0]-g.pivot[0]),bellAngle=g.restAngle+Math.atan2(Math.sin(rawAngle-g.restAngle),Math.cos(rawAngle-g.restAngle));
 const output=[g.pivot[0]+g.outputLength*Math.cos(bellAngle+g.includedAngle),g.pivot[1]+g.outputLength*Math.sin(bellAngle+g.includedAngle)];
 const span=g.guideX-output[0],radicand=g.rodLength**2-span**2;if(radicand<=0)throw new RangeError('Output rod cannot reach its guide');
 const slider=[g.guideX,output[1]-Math.sqrt(radicand)];
 return{time,driverAngle,pin,input,bellAngle,output,slider,couplerAngle:Math.atan2(input[1]-pin[1],input[0]-pin[0]),rodAngle:Math.atan2(slider[1]-output[1],span)};
}
