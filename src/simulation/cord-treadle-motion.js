// Source-center measurements currently used by 159. The full-turn floor
// conflict is recorded in docs/movement-159.md; these are not a corrected fit.
export const cordTreadleSource={diskCenter:[113,266],diskRadius:90,pin:[178,303],guide:[279,106],guideRadius:45,pivot:[457,352],eye:[319,389],footLength:297,ground:457,scale:.16*10/90,period:4};
export function cordTreadleParameters(source=cordTreadleSource){
 const point=p=>[(p[0]-source.diskCenter[0])*source.scale,(source.diskCenter[1]-p[1])*source.scale];
 const pivot=point(source.pivot),eye=point(source.eye),armLength=Math.hypot(eye[0]-pivot[0],eye[1]-pivot[1]),initialTreadle=Math.atan2(pivot[1]-eye[1],pivot[0]-eye[0]);
 const g={pin:point(source.pin),pivot,guide:point(source.guide),guideRadius:source.guideRadius*source.scale,armLength,footLength:source.footLength*source.scale,initialTreadle,period:source.period,groundY:(source.diskCenter[1]-source.ground)*source.scale};g.cordLength=cordTreadleMetrics(0,initialTreadle,g).length;return g;
}
export function cordTreadleMetrics(diskAngle,treadleAngle,g){
 const c=Math.cos(diskAngle),s=Math.sin(diskAngle),pin=[g.pin[0]*c-g.pin[1]*s,g.pin[0]*s+g.pin[1]*c],eye=[g.pivot[0]-g.armLength*Math.cos(treadleAngle),g.pivot[1]-g.armLength*Math.sin(treadleAngle)],r=g.guideRadius;
 const tangent=(p,entry)=>{const dx=p[0]-g.guide[0],dy=p[1]-g.guide[1],d2=dx*dx+dy*dy;if(d2<=r*r)throw new RangeError('Cord endpoint entered guide pulley');const k=r*Math.sqrt(d2-r*r)/d2;let best,score=-Infinity;for(const sign of [-1,1]){const q=[g.guide[0]+dx*r*r/d2-sign*dy*k,g.guide[1]+dy*r*r/d2+sign*dx*k],vx=(q[0]-p[0])*(entry?1:-1),vy=(q[1]-p[1])*(entry?1:-1),alignment=vx*(q[1]-g.guide[1])-vy*(q[0]-g.guide[0]);if(alignment>score){score=alignment;best=q;}}return best;};
 const entry=tangent(pin,true),exit=tangent(eye,false),entryAngle=Math.atan2(entry[1]-g.guide[1],entry[0]-g.guide[0]),exitAngle=Math.atan2(exit[1]-g.guide[1],exit[0]-g.guide[0]);let sweep=exitAngle-entryAngle;while(sweep>=0)sweep-=Math.PI*2;while(sweep<-Math.PI*2)sweep+=Math.PI*2;
 const incoming=Math.hypot(entry[0]-pin[0],entry[1]-pin[1]),outgoing=Math.hypot(eye[0]-exit[0],eye[1]-exit[1]);return{pin,eye,entry,exit,entryAngle,exitAngle,sweep,incoming,outgoing,length:incoming-r*sweep+outgoing};
}
export function cordTreadleState(time,g=cordTreadleParameters()){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Time must be finite and nonnegative');const diskAngle=2*Math.PI*time/g.period;
 let lower=-.55,upper=1.18,error=cordTreadleMetrics(diskAngle,lower,g).length-g.cordLength;if(error*(cordTreadleMetrics(diskAngle,upper,g).length-g.cordLength)>0)throw new RangeError('Taut cord branch cannot be assembled');
 for(let i=0;i<54;i++){const mid=(lower+upper)/2,e=cordTreadleMetrics(diskAngle,mid,g).length-g.cordLength;if(error*e<=0)upper=mid;else{lower=mid;error=e;}}
 const treadleAngle=(lower+upper)/2,metrics=cordTreadleMetrics(diskAngle,treadleAngle,g),foot=[g.pivot[0]-g.footLength*Math.cos(treadleAngle),g.pivot[1]-g.footLength*Math.sin(treadleAngle)];return{time,diskAngle,treadleAngle,foot,...metrics};
}
