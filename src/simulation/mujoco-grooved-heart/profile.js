import source from './source.js';

// Geometry reference only: native contact supplies the follower trajectory.
export function makeGroovedHeartProfile({segments=768,clearance=.0005}={}) {
  const minimum=(source.eye[0]-source.axis[0])/100,maximum=(source.axis[0]-source.nose[0])/100;
  const halfWidth=source.grooveWidth/200,pinRadius=halfWidth-clearance;
  const middle=(minimum+maximum)/2,half=(maximum-minimum)/2;
  const law=angle=>{
    const a=((angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
    let r=middle-half*Math.cos(a),derivative=half*Math.sin(a),secondDerivative=half*Math.cos(a);
    source.radialCoefficients.forEach((pixels,i)=>{
      const n=i+2,c=pixels/100;r+=c*(Math.cos(n*a)-(n%2?Math.cos(a):1));
      derivative+=c*(-n*Math.sin(n*a)+(n%2?Math.sin(a):0));
      secondDerivative+=c*(-n*n*Math.cos(n*a)+(n%2?Math.cos(a):0));
    });
    return {r,derivative,secondDerivative};
  };
  const at=(angle,offset=0)=>{
    const {r,derivative:dr}=law(angle),c=Math.cos(angle),s=Math.sin(angle),length=Math.hypot(r,dr);
    return [r*c+offset*(r*c+dr*s)/length,r*s+offset*(r*s-dr*c)/length];
  };
  const angles=Array.from({length:segments},(_,i)=>i*2*Math.PI/segments),inner=angles.map(a=>at(a,-halfWidth)),outer=angles.map(a=>at(a,halfWidth));
  return {minimum,maximum,stroke:maximum-minimum,halfWidth,pinRadius,clearance,law,at,inner,outer,segments};
}
