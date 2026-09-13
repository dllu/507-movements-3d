import source from './source.js';
import {poly,polygonClipping as clip} from '../finite-plate-geometry.js';

// Geometry reference only: native contact supplies the follower trajectory.
export function makeGroovedHeartProfile({segments=1536,clearance=.0005,reversalAngle=.08}={}) {
  const minimum=(source.eye[0]-source.axis[0])/100,maximum=(source.axis[0]-source.nose[0])/100;
  const halfWidth=source.grooveWidth/200,pinRadius=halfWidth-clearance;
  const stroke=maximum-minimum,d=reversalAngle,slope=stroke/(Math.PI-d);
  const halfLaw=u=>{
    if(u<d){const t=u/d;return [minimum+slope*d*(t**3-t**4/2),slope*(3*t*t-2*t**3),slope/d*(6*t-6*t*t)];}
    if(u>Math.PI-d){const t=(Math.PI-u)/d;return [maximum-slope*d*(t**3-t**4/2),slope*(3*t*t-2*t**3),-slope/d*(6*t-6*t*t)];}
    return [minimum+slope*(u-d/2),slope,0];
  };
  const law=angle=>{
    const a=((angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI),sign=a>Math.PI?-1:1;
    const [r,derivative,secondDerivative]=halfLaw(Math.min(a,2*Math.PI-a));return {r,derivative:sign*derivative,secondDerivative};
  };
  const at=(angle,offset=0)=>{
    const {r,derivative:dr}=law(angle),c=Math.cos(angle),s=Math.sin(angle),length=Math.hypot(r,dr);
    return [r*c+offset*(r*c+dr*s)/length,r*s+offset*(r*s-dr*c)/length];
  };
  const angles=Array.from({length:segments},(_,i)=>i*2*Math.PI/segments),inner=angles.map(a=>at(a,-halfWidth)),rawOuter=angles.map(a=>at(a,halfWidth));
  // At the concave reversal the outward normal offset folds over itself.
  // Its union with the pitch region removes that fold from the machined wall.
  const outer=clip.union(poly(rawOuter),poly(angles.map(a=>at(a))))[0][0].slice(0,-1);
  return {minimum,maximum,stroke,halfWidth,pinRadius,clearance,law,at,inner,outer,segments,reversalAngle,slope};
}
