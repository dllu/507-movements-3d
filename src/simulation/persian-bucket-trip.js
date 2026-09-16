import * as THREE from 'three';

// Planar unilateral contact between a round fixed pin and a finite capsule shoe.
// The rising branch follows exact tangency. The subsequent gravity return is a
// prescribed clear swing, not an impact, inertia or pendulum-force solution.
export function makePersianBucketTrip(radius, centerY, startAngle) {
  const shoeX=-.31, shoeBottom=-.57, shoeTop=-.04;
  const shoeRadius=.035, pinRadius=.07, contactRadius=shoeRadius+pinRadius;
  const pin=new THREE.Vector3(radius*Math.cos(startAngle)+shoeX-contactRadius,
    centerY+radius*Math.sin(startAngle)+shoeTop,.96);
  const boundary=(angle)=>{
    const qx=pin.x-radius*Math.cos(angle),qy=pin.y-centerY-radius*Math.sin(angle);
    const r=Math.hypot(qx,qy),theta=Math.atan2(qy,qx),candidates=[];
    if(r>=Math.abs(shoeX-contactRadius)) {
      const phi=theta+Math.acos((shoeX-contactRadius)/r);
      const y=-qx*Math.sin(phi)+qy*Math.cos(phi);
      if(y>=shoeBottom-1e-9&&y<=shoeTop+1e-9)candidates.push(phi);
    }
    for(const y of [shoeBottom,shoeTop]) {
      const arm=Math.hypot(shoeX,y),cosine=(arm*arm+r*r-contactRadius**2)/(2*arm*r);
      if(Math.abs(cosine)>1)continue;
      for(const sign of [-1,1]) {
        const phi=theta-Math.atan2(y,shoeX)+sign*Math.acos(cosine);
        const localY=-qx*Math.sin(phi)+qy*Math.cos(phi);
        if(y===shoeBottom?localY<=y+1e-9:localY>=y-1e-9)candidates.push(phi);
      }
    }
    return Math.max(0,...candidates.filter(phi=>phi>=-1e-8&&phi<Math.PI));
  };
  let peak=startAngle;
  for(let i=1;i<=400;i++) {
    const a=startAngle+i*Math.PI/1800;
    if(boundary(a)>boundary(peak))peak=a;
  }
  let low=peak-Math.PI/1800,high=peak+Math.PI/1800;
  for(let i=0;i<48;i++) {
    const a=(2*low+high)/3,b=(low+2*high)/3;
    if(boundary(a)<boundary(b))low=a;else high=b;
  }
  peak=(low+high)/2;
  const maximum=boundary(peak),end=peak+THREE.MathUtils.degToRad(38);
  const smooth=t=>t*t*t*(10+t*(-15+6*t));
  const angleAt=angle=> {
    const a=THREE.MathUtils.euclideanModulo(angle,Math.PI*2);
    if(a<startAngle||a>=end)return 0;
    if(a<=peak)return boundary(a);
    return maximum*(1-smooth((a-peak)/(end-peak)));
  };
  return {pin,shoeX,shoeBottom,shoeTop,shoeRadius,pinRadius,start:startAngle,peak,end,maximum,angleAt,boundary};
}
