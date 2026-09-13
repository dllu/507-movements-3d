import source from './source.js';
import {rotate,poly} from '../finite-plate-geometry.js';

export function makeSpiralFeedProfile({segments=3072,clearance=.0005}={}) {
  const [a,b,c,d]=source.spiral.map(x=>x/100),halfWidth=source.railWidth/200;
  const radius=t=>a+b*t+c*Math.cos(t)+d*Math.sin(t),derivative=t=>b-c*Math.sin(t)+d*Math.cos(t);
  const at=t=>rotate([radius(t),0],-Math.PI/2-t);
  const normal=t=>{const r=radius(t),dr=derivative(t),h=Math.hypot(r,dr);return rotate([r/h,dr/h],-Math.PI/2-t);};
  const offset=(t,w)=>{const p=at(t),n=normal(t);return p.map((v,i)=>v+w*n[i]);};
  const endAngle=Math.atan2(source.axis[1]-source.end[1],source.end[0]-source.axis[0]),sweep=9*Math.PI-(endAngle-Math.PI/2);
  const parameters=Array.from({length:segments+1},(_,i)=>sweep*i/segments),inner=parameters.map(t=>offset(t,-halfWidth)),outer=parameters.map(t=>offset(t,halfWidth));
  const initialParameter=4*Math.PI,endReserve=.03,range=[-initialParameter+endReserve,sweep-2*Math.PI-initialParameter-endReserve];
  const middleRadius=q=>radius(initialParameter+q)+Math.PI*b;
  // Offset the actual spiral along its normals, then intersect the offset
  // envelope with the follower axis. This is diagnostic geometry, not an
  // output constraint. Adjacent turns retain the same radial pitch.
  const contactRadius=(q,w,turn)=>{
    const nominal=initialParameter+q+turn*2*Math.PI;
    let low=nominal-.4,high=nominal+.4;
    for(let i=0;i<48;i++) {
      const t=(low+high)/2,p=rotate(offset(t,w),q);
      if(p[0]>0)low=t;else high=t;
    }
    const t=(low+high)/2,p=rotate(offset(t,w),q);return {r:-p[1],t,point:offset(t,w)};
  };
  let rollerRadius=Math.PI*b-halfWidth-clearance;
  // Bound a constant-diameter roller over every pitch, including the inner
  // turns where the finite spiral slope makes the normal spacing smallest.
  for(let i=0;i<=720;i++) {
    const q=range[0]+(range[1]-range[0])*i/720;
    let low=0,high=rollerRadius;
    for(let j=0;j<24;j++) {
      const r=(low+high)/2,lower=contactRadius(q,halfWidth+r,0).r,upper=contactRadius(q,-halfWidth-r,1).r;
      if(upper-lower>=2*clearance)low=r;else high=r;
    }
    rollerRadius=Math.min(rollerRadius,low);
  }
  const envelope=q=>({inner:contactRadius(q,halfWidth+rollerRadius,0),outer:contactRadius(q,-halfWidth-rollerRadius,1)});
  return {segments,clearance,halfWidth,radius,derivative,at,normal,offset,sweep,parameters,inner,outer,initialParameter,endReserve,range,middleRadius,rollerRadius,envelope,
    polygon:poly([...outer,...[...inner].reverse()])};
}
