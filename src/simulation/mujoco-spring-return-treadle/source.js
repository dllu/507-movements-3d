import {CatmullRomCurve3,Vector3} from 'three';

// Centerline midway between the two ink boundaries of the 525-pixel plate.
// x=360 is obscured by the tie and x=380's upper mark includes the knot:
// use the leaf boundary at y=108..109 there. The cut left end is read manually.
export const springReturnSource={scale:.018,origin:[319,252],tie:[362,104],eyeX:362,
 centerline:[[35,191],[60,171.5],[80,158.25],[100,146.75],[120,136.75],
 [140,128],[160,120.5],[180,115],[200,109.5],[220,106],[240,103.5],
 [260,102.75],[280,102.25],[300,103],[320,105],[340,107.75],
 [380,116.75],[400,123.5],[415,128.5]]};
export function sourceLeaf({segments=32,tailSegments=6}={}){
 if(!Number.isInteger(segments)||segments<4||!Number.isInteger(tailSegments)||tailSegments<1)throw new RangeError('Invalid leaf resolution');
 const s=springReturnSource,toWorld=([x,y])=>new Vector3((x-s.origin[0])*s.scale,(s.origin[1]-y)*s.scale,0);
 const curve=new CatmullRomCurve3(s.centerline.map(toWorld),false,'centripetal');curve.arcLengthDivisions=4096;
 let lo=0,hi=1;const eyeX=(s.eyeX-s.origin[0])*s.scale;
 for(let i=0;i<48;i++){const t=(lo+hi)/2;if(curve.getPointAt(t).x<eyeX)lo=t;else hi=t;}
 const eyeFraction=(lo+hi)/2,points=Array.from({length:segments+1},(_,i)=>curve.getPointAt(eyeFraction*i/segments));
 for(let i=1;i<=tailSegments;i++)points.push(curve.getPointAt(eyeFraction+(1-eyeFraction)*i/tailSegments));
 return{points,eyeIndex:segments,tie:toWorld(s.tie),curve,length:points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0)};
}
