import * as THREE from 'three';
const TAU=2*Math.PI;
// Brown's slot is a plain crescent: one circular arc with rounded ends, no
// hooks. Its ends lie where the crank pin comes nearest to and farthest from
// the rocker pivot (on the line through both centres), so the pin reaches
// each end exactly as its distance from the pivot turns round, and that
// distance selects a unique point of the slot. The arc bulges toward the side
// the pin runs on while the rocker should rest; with a sagitta equal to the
// crank radius it would be the crank circle itself (a true dwell, but a hard
// knock at each end where it meets the radius circles tangentially). A
// slightly flatter arc (sagitta = arcSagitta * crank radius) crosses them at
// a finite angle, so the rocker leaves and rejoins its near-rest smoothly.
// With an explicit arc ({center, radius} about the rocker pivot, in the
// rocker's frame at angle 0) the slot is that arc instead: the pin radius
// still selects a unique station, on the arc's counterclockwise side of the
// pivot-to-centre line, and the arc need not pass through the pin's nearest
// and farthest points as they stand at rest.
export function openCrescentShuttleLaw({crankCenter,rockerPivot,crankRadius,reference,period,arcSagitta=.8,arc=null}){
  const c=crankCenter.clone().sub(rockerPivot),D=c.length(),beta=Math.atan2(c.y,c.x),low=D-crankRadius,high=D+crankRadius;
  const omega=TAU/period,u=new THREE.Vector2(Math.cos(beta),Math.sin(beta)),n=new THREE.Vector2(-u.y,u.x);
  const sag=arcSagitta*crankRadius,arcRadius=arc?arc.radius:(crankRadius*crankRadius+sag*sag)/(2*sag);
  const arcCenter=arc?new THREE.Vector2(arc.center[0],arc.center[1]):c.clone().addScaledVector(n,sag-arcRadius),dC=arcCenter.length(),e=arcCenter.clone().multiplyScalar(1/dC);
  function slotAngle(rho){
    rho=Math.max(low,Math.min(high,rho));
    const a=(rho*rho-arcRadius*arcRadius+dC*dC)/(2*dC),h=Math.sqrt(Math.max(0,rho*rho-a*a));
    const p1=new THREE.Vector2(a*e.x-h*e.y,a*e.y+h*e.x),p2=new THREE.Vector2(a*e.x+h*e.y,a*e.y-h*e.x);
    const p=arc?p1:p1.clone().sub(c).dot(n)>p2.clone().sub(c).dot(n)?p1:p2;
    return Math.atan2(p.y,p.x);
  }
  // Exact derivatives from the implicit arc G(rho, f) = |rho u(f) - C|^2 - R^2 = 0.
  function profile(rho){
    rho=Math.max(low,Math.min(high,rho));
    const f=slotAngle(rho),cu=arcCenter.x*Math.cos(f)+arcCenter.y*Math.sin(f),cv=-arcCenter.x*Math.sin(f)+arcCenter.y*Math.cos(f);
    const gr=2*rho-2*cu,gf=-2*rho*cv,grr=2,grf=-2*cv,gff=2*rho*cu;
    const d=-gr/gf,dd=-(grr+2*grf*d+gff*d*d)/gf;
    return {angle:f,d,dd,circular:false};
  }
  function atPhase(phase){
    const theta=reference+TAU*phase,p=new THREE.Vector2(c.x+crankRadius*Math.cos(theta),c.y+crankRadius*Math.sin(theta));
    const v=new THREE.Vector2(-crankRadius*Math.sin(theta),crankRadius*Math.cos(theta)),acc=new THREE.Vector2(-crankRadius*Math.cos(theta),-crankRadius*Math.sin(theta));
    const rho=p.length(),rd=p.dot(v)/rho,rdd=(v.lengthSq()+p.dot(acc)-rd*rd)/rho;
    const cross=(a,b)=>a.x*b.y-a.y*b.x,psi=Math.atan2(p.y,p.x),pd=cross(p,v)/(rho*rho),pdd=cross(p,acc)/(rho*rho)-2*pd*rd/rho;
    const f=profile(rho),angle=psi-f.angle,speed=(pd-f.d*rd)*omega,acceleration=(pdd-f.dd*rd*rd-f.d*rdd)*omega*omega;
    const dwell=Math.abs(speed)<.05*omega&&Math.abs(angle)<.15;
    return {angle,angularSpeed:speed,angularAcceleration:acceleration,
      lawPhase:((phase%1)+1)%1,stage:dwell?'near-rest-on-crescent-arc':speed<0?'outward-output-stroke':'return-output-stroke',rho,
      progress:(rho-low)/(high-low),slotPoint:new THREE.Vector2(rho*Math.cos(f.angle),rho*Math.sin(f.angle))};
  }
  return {atPhase,profile,low,high,beta,arcSagitta:arc?null:arcSagitta,arcRadius,arcCenter,
    pointAtRadius:rho=>{const f=profile(rho);return new THREE.Vector2(rho*Math.cos(f.angle),rho*Math.sin(f.angle));}};
}
