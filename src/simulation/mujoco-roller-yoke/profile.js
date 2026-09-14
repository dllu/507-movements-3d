import source from './source.js';
export function makeRollerYokeProfile({samples=1024}={}){
 if(!Number.isInteger(samples)||samples<128)throw new RangeError('Invalid 117 profile resolution');
 const at=phi=>{let radius=source.meanPitchRadius,first=0,second=0;for(const [h,a,b]of source.coefficients){const c=Math.cos(h*phi),s=Math.sin(h*phi);radius+=a*c+b*s;first+=h*(-a*s+b*c);second-=h*h*(a*c+b*s);}const c=Math.cos(phi),s=Math.sin(phi),speed=Math.hypot(radius,first),normal=[(radius*c+first*s)/speed,(radius*s-first*c)/speed],point=[radius*c-source.rollerRadius*normal[0],radius*s-source.rollerRadius*normal[1]],curvature=(radius*radius+2*first*first-radius*second)/speed**3;return{radius,first,second,speed,normal,point,curvature};};
 const frames=Array.from({length:samples},(_,i)=>at(i*2*Math.PI/samples));
 return{at,points:frames.map(f=>f.point),samples,minimum:Math.min(...frames.map(f=>f.radius))-source.meanPitchRadius,maximum:Math.max(...frames.map(f=>f.radius))-source.meanPitchRadius,minimumOffsetJacobian:Math.min(...frames.map(f=>1-source.rollerRadius*f.curvature)),initialQ:source.initialQ};
}
