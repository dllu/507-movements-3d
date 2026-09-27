import * as THREE from 'three';
export const stop240Radius=.065,stop240SeatFraction=.35;
// Wheel advance, in pitches, over one drive: it overshoots about 0.11 pitch
// so the stop drops off the tip, then slips back onto the steep face.
export const STOP240_OVERSHOOT=4;
export function stop240Advance(q){const c=STOP240_OVERSHOOT;return{value:q+c*q**6*(1-q),first:1+c*(6*q**5-7*q**6),second:c*(30*q**4-42*q**5)};}
export function stop240Definitions(definitions,profile){return definitions.map(stop=>{
 // The toe bears low on the steep face that rises from the tooth's root.
 const root=profile[stop.rootIndex*3],outer=profile[stop.rootIndex*3+1],tangent=outer.clone().sub(root).normalize(),normal=new THREE.Vector2(tangent.y,-tangent.x),point=root.clone().lerp(outer,stop240SeatFraction),center=point.clone().addScaledVector(normal,stop240Radius),arm=center.clone().sub(stop.pivot);
 return{...stop,sourceArm:stop.arm.clone(),arm,armLength:arm.length(),restAngle:Math.atan2(arm.y,arm.x),seatedPoint:point,noseCenter:center,normal};
});}
export function stop240Contact(stop,lift,angle,outline){
 const a=stop.restAngle+stop.liftSign*lift,x=stop.pivot.x+stop.armLength*Math.cos(a),y=stop.pivot.y+stop.armLength*Math.sin(a),c=Math.cos(angle),s=Math.sin(angle),px=x*c+y*s,py=-x*s+y*c;
 let best=Infinity,point,edge,uBest,inside=false;
 for(let i=0,j=outline.length-1;i<outline.length;j=i++){
  const a=outline[j],b=outline[i],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(dx*dx+dy*dy))),qx=a.x+u*dx,qy=a.y+u*dy,dist=Math.hypot(px-qx,py-qy);
  if(dist<best){best=dist;point=[qx*c-qy*s,qx*s+qy*c];edge=j;uBest=u;}
  if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 const normal=new THREE.Vector2((x-point[0])/best,(y-point[1])/best),world=new THREE.Vector2(...point);
 return{center:new THREE.Vector2(x,y),point:world,outwardNormal:normal,normalClearance:(inside?-best:best)-stop240Radius,
  edgeCoordinate:uBest,edge:{index:edge,type:['reverse-lock-face','short-tip','rising-ramp'][edge%3],toothIndex:Math.floor(edge/3)},
  retainingMoment:-world.x*normal.y+world.y*normal.x,openingMoment:stop.liftSign*((x-stop.pivot.x)*normal.y-(y-stop.pivot.y)*normal.x)};
}
