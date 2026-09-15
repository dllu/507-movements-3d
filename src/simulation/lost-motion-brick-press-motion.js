const TAU=2*Math.PI;
export function lostMotionBrickGeometry(){
 const scale=.015,crankRadius=Math.hypot(87,53)*scale,outer=28*crankRadius/5.5,clearance=.004;
 return{scale,center:[0,1.5],diskRadius:203*scale,crankRadius,pinRadius:.315,clearance,outer,inner:outer-44*scale-2*clearance,phase:Math.atan2(53,-87),period:4};
}

// Ideal resisting load holds the output while the pin crosses the slot. The
// engaged portions are ordinary slider-crank closure with either end distance.
export function lostMotionBrickAtAngle(angle,g=lostMotionBrickGeometry()){
 const a=((angle%TAU)+TAU)%TAU,r=g.crankRadius,right=g.inner+r,left=g.outer-r;
 const outerEngagement=Math.acos((right*right+r*r-g.outer*g.outer)/(2*right*r));
 const innerEngagement=TAU-Math.acos((left*left+r*r-g.inner*g.inner)/(2*left*r));
 const pin=[r*Math.cos(a),r*Math.sin(a)];let x,stage,end=null;
 if(a<outerEngagement){x=right;stage='right-dwell';}
 else if(a<Math.PI){end=g.outer;stage='retract';}
 else if(a<innerEngagement){x=left;stage='left-dwell';}
 else{end=g.inner;stage='advance';}
 if(end!==null)x=pin[0]+Math.sqrt(end*end-pin[1]*pin[1]);
 const distance=Math.hypot(x-pin[0],pin[1]),rodAngle=-Math.atan2(pin[1],x-pin[0]);
 return{angle,normalizedAngle:a,pin,x,rodAngle,distance,stage,outerEngagement,innerEngagement,right,left,stroke:right-left,dwellFraction:(outerEngagement+innerEngagement-Math.PI)/TAU};
}
export function lostMotionBrickState(time,g=lostMotionBrickGeometry()){return lostMotionBrickAtAngle(g.phase+TAU*time/g.period,g);}
