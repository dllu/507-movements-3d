import {nativePlateContours,pointInsidePolygon,rotatingContourEvents,rotate2} from './weighted-clutch-native-contours.mjs';

export function makeWeightedClutchNativeCouplings(model){
 const u=model.root.userData,C=u.lostMotion.parameters,
  middle=(C.lower+C.upper)/2,slotPoint=[C.radius*Math.cos(middle),C.radius*Math.sin(middle)],
  contours=nativePlateContours(u.parts.slottedQuadrant.geometry),outer=contours.find(r=>pointInsidePolygon([0,0],r)&&pointInsidePolygon(slotPoint,r)),
  slot=contours.filter(r=>r!==outer&&pointInsidePolygon(slotPoint,r));
 if(slot.length!==1)throw Error('Native curved slot is not uniquely identified');
 const hole=slot[0],pin=nativePlateContours(u.parts.slotFollowerPin.geometry)[0].map(p=>p.map((v,i)=>v+u.parts.slotFollowerPin.position.toArray()[i])),
  thetaMiddle=middle-C.followerAngle,events=rotatingContourEvents(hole,pin),
  lower=events.filter(e=>e.angle<thetaMiddle).at(-1),upper=events.find(e=>e.angle>thetaMiddle);
 if(!lower||!upper||!(lower.gapDerivative>0&&upper.gapDerivative<0))throw Error('Invalid native slot interval');
 if(!pin.every(p=>pointInsidePolygon(rotate2(p,thetaMiddle),hole)))throw Error('Slot reference pose is not free');
 const shoe=nativePlateContours(u.parts.clutchForkShoe.geometry)[0].map(p=>p.map((v,i)=>v+u.parts.clutchForkShoe.position.toArray()[i])),
  F=u.linkage.parameters.F,wallLeft=Math.fround(u.geometry.waist-u.geometry.grooveHalf),wallRight=Math.fround(u.geometry.waist+u.geometry.grooveHalf);
 const fork=(s,x)=>{
  const points=shoe.map(p=>rotate2(p,s));let lo=0,hi=0;
  for(let i=1;i<points.length;i++){if(points[i][0]<points[lo][0])lo=i;if(points[i][0]>points[hi][0])hi=i;}
  return [{kind:'fork-left',gap:F[0]+points[lo][0]-x-wallLeft,gradient:[0,-points[lo][1],-1],point:points[lo].map((v,i)=>v+F[i]),vertex:lo},
   {kind:'fork-right',gap:x+wallRight-F[0]-points[hi][0],gradient:[0,points[hi][1],1],point:points[hi].map((v,i)=>v+F[i]),vertex:hi}];
 };
 const query=([q,s,x])=>[
  {kind:'slot-lower',gap:s-q-lower.angle,gradient:[-1,1,0]},
  {kind:'slot-upper',gap:upper.angle-s+q,gradient:[1,-1,0]},...fork(s,x),
 ];
 return{query,fork,parameters:{hole,pin,shoe,F,lower,upper,thetaMiddle,events,wallLeft,wallRight,
  qualification:'Exact native planar vertex/edge events delimit the connected free slot interval for coaxial F and shifter rotation. Fork constraints use the actual polygonal shoe extrema and Float32 axial groove planes; their witnesses must also lie within the finite groove walls. Slot gaps are angular, fork gaps are axial. No shifter motion or jaw constraint is prescribed.'}};
}
