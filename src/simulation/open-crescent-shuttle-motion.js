import * as THREE from 'three';
const TAU=2*Math.PI;
const gate=(x,width)=>{
  const u=Math.max(0,Math.min(1,x/width));
  return {v:u*u*u*(10-15*u+6*u*u),d:u>0&&u<1?30*u*u*(1-u)*(1-u)/width:0,
    dd:u>0&&u<1?60*u*(1-u)*(1-2*u)/(width*width):0};
};
// The pin's distance from the rocker pivot uniquely locates it along an OPEN
// crescent. Circular middle portions supply dwell; short radial-ended blends
// let the pin reverse without changing assembly branch or velocity abruptly.
export function openCrescentShuttleLaw({crankCenter,rockerPivot,crankRadius,reference,period}){
  const c=crankCenter.clone().sub(rockerPivot),D=c.length(),beta=Math.atan2(c.y,c.x),low=D-crankRadius,high=D+crankRadius;
  const endBlend=.20*crankRadius,endAngle=.25,omega=TAU/period;
  function profile(rho){
    rho=Math.max(low,Math.min(high,rho));
    const q=Math.max(-1,Math.min(1,(rho*rho+D*D-crankRadius*crankRadius)/(2*rho*D))),a=Math.acos(q);
    const l=gate(rho-low,endBlend),h=gate(high-rho,endBlend),w=l.v*h.v,wd=l.d*h.v-l.v*h.d,wdd=l.dd*h.v-2*l.d*h.d+l.v*h.dd;
    const sq=Math.sqrt(Math.max(1e-15,1-q*q)),qd=(1-(D*D-crankRadius*crankRadius)/(rho*rho))/(2*D),qdd=(D*D-crankRadius*crankRadius)/(D*rho*rho*rho);
    const ad=-qd/sq,add=-qdd/sq-q*qd*qd/(sq*sq*sq);
    return {angle:beta+endAngle+w*(a-endAngle),d:wd*(a-endAngle)+w*ad,
      dd:wdd*(a-endAngle)+2*wd*ad+w*add,circular:w===1};
  }
  function atPhase(phase){
    const theta=reference+TAU*phase,p=new THREE.Vector2(c.x+crankRadius*Math.cos(theta),c.y+crankRadius*Math.sin(theta));
    const v=new THREE.Vector2(-crankRadius*Math.sin(theta),crankRadius*Math.cos(theta)),acc=new THREE.Vector2(-crankRadius*Math.cos(theta),-crankRadius*Math.sin(theta));
    const rho=p.length(),rd=p.dot(v)/rho,rdd=(v.lengthSq()+p.dot(acc)-rd*rd)/rho;
    const cross=(a,b)=>a.x*b.y-a.y*b.x,psi=Math.atan2(p.y,p.x),pd=cross(p,v)/(rho*rho),pdd=cross(p,acc)/(rho*rho)-2*pd*rd/rho;
    const f=profile(rho),angle=psi-f.angle,speed=(pd-f.d*rd)*omega,acceleration=(pdd-f.dd*rd*rd-f.d*rdd)*omega*omega;
    const dwell=f.circular&&Math.abs(angle)<1e-12;
    return {angle,angularSpeed:dwell?0:speed,angularAcceleration:dwell?0:acceleration,
      lawPhase:((phase%1)+1)%1,stage:dwell?'source-circular-arc-dwell':speed<0?'outward-output-stroke':'return-output-stroke',rho,
      progress:(rho-low)/(high-low),slotPoint:new THREE.Vector2(rho*Math.cos(f.angle),rho*Math.sin(f.angle))};
  }
  return {atPhase,profile,low,high,beta,endBlend,endAngle,
    pointAtRadius:rho=>{const f=profile(rho);return new THREE.Vector2(rho*Math.cos(f.angle),rho*Math.sin(f.angle));}};
}
