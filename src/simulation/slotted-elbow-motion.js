// Engraving landmarks in the original 525px image. The cropped lower guide and
// full rod length are not measured: they are explicit reconstruction parameters.
export const slottedElbowSource={
 diskCenter:[214,209],diskRadius:118,crankPin:[140,157],pinRadius:17,
 pivot:[280,388],output:[438,289],nearCap:[241,332],farCap:[103,96],
 slotHalfWidth:17,armHalfWidth:35,rodLength:270,guideX:438,scale:.014,period:4,
};
export function slottedElbowParameters(source=slottedElbowSource){
 const point=([x,y])=>[(x-source.diskCenter[0])*source.scale,(source.diskCenter[1]-y)*source.scale];
 const pivot=point(source.pivot),pin=point(source.crankPin),output=point(source.output);
 const axis=[pin[0]-pivot[0],pin[1]-pivot[1]],station=Math.hypot(...axis),direction=axis.map(x=>x/station),restAngle=Math.atan2(axis[1],axis[0]);
 const capDistance=p=>{const q=point(p);return(q[0]-pivot[0])*direction[0]+(q[1]-pivot[1])*direction[1];};
 return{pivot,pin,restAngle,includedAngle:Math.atan2(output[1]-pivot[1],output[0]-pivot[0])-restAngle,outputLength:Math.hypot(output[0]-pivot[0],output[1]-pivot[1]),rodLength:source.rodLength*source.scale,guideX:point([source.guideX,0])[0],period:source.period,nearCapDistance:capDistance(source.nearCap),farCapDistance:capDistance(source.farCap)};
}

/** Ideal pin-in-slot and pinned-rod constraints; no dynamics or prescribed follower curves. */
export function slottedElbowState(time,g=slottedElbowParameters()){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid movement time');
 const driverAngle=-2*Math.PI*time/g.period,c=Math.cos(driverAngle),s=Math.sin(driverAngle);
 const pin=[g.pin[0]*c-g.pin[1]*s,g.pin[0]*s+g.pin[1]*c];
 const dx=pin[0]-g.pivot[0],dy=pin[1]-g.pivot[1],slotStation=Math.hypot(dx,dy);
 if(slotStation<1e-12)throw new RangeError('Pin reaches the fixed pivot');
 const rawAngle=Math.atan2(dy,dx),slotAngle=g.restAngle+Math.atan2(Math.sin(rawAngle-g.restAngle),Math.cos(rawAngle-g.restAngle));
 const outputAngle=slotAngle+g.includedAngle,output=[g.pivot[0]+g.outputLength*Math.cos(outputAngle),g.pivot[1]+g.outputLength*Math.sin(outputAngle)];
 const span=g.guideX-output[0],radicand=g.rodLength*g.rodLength-span*span;
 if(radicand<=0)throw new RangeError('Output rod cannot reach its guide without a singularity');
 const slider=[g.guideX,output[1]-Math.sqrt(radicand)];
 return{time,driverAngle,pin,slotAngle,slotStation,output,slider,rodAngle:Math.atan2(slider[1]-output[1],span)};
}
