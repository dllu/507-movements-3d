import source from './source.js';
// A roller-envelope heart cam with uniform travel between short C2 reversals.
// The return force and output motion belong to physics; this law specifies
// only the machined cam and provides an independent reference for checks.
export function makeHeartCamProfile({segments=768,reversalAngle=.08}={}) {
  const minimum=(source.roller[0]-source.axis[0])/100,rollerRadius=source.rollerRadius/100;
  const maximum=(source.constructionRadius+source.rollerRadius)/100,stroke=maximum-minimum;
  const slope=stroke/(Math.PI-reversalAngle),d=reversalAngle;
  const halfLaw=u=>{
    if(u<d){const t=u/d;return [minimum+slope*d*(t**3-t**4/2),slope*(3*t*t-2*t**3),slope/d*(6*t-6*t*t)];}
    if(u>Math.PI-d){const t=(Math.PI-u)/d;return [maximum-slope*d*(t**3-t**4/2),slope*(3*t*t-2*t**3),-slope/d*(6*t-6*t*t)];}
    return [minimum+slope*(u-d/2),slope,0];
  };
  const law=angle=>{const a=((angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI),sign=a>Math.PI?-1:1,[r,v,acc]=halfLaw(Math.min(a,2*Math.PI-a));return {r,derivative:sign*v,secondDerivative:acc};};
  const at=angle=>{const {r,derivative:dr}=law(angle),c=Math.cos(angle),s=Math.sin(angle),length=Math.hypot(r,dr),normal=[(r*c+dr*s)/length,(r*s-dr*c)/length];return [r*c-rollerRadius*normal[0],r*s-rollerRadius*normal[1]];};
  const points=Array.from({length:segments},(_,i)=>at(i*2*Math.PI/segments));
  return {points,at,law,minimum,maximum,stroke,slope,rollerRadius,reversalAngle,segments};
}
