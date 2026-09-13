import {THREE} from './weighted-clutch-independent-candidate.mjs';
import {cross2,subtract2,dot2,rotate2} from './weighted-clutch-native-contours.mjs';

const tau=2*Math.PI,bins=768,mod=i=>(i%bins+bins)%bins;
const height=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2];
const minimumAffine=(p,x,y)=>Math.min(x*p[0][0]+y*p[0][1],x*p[1][0]+y*p[1][1],x*p[2][0]+y*p[2][1]);
function describe(points,id){
 let yz=points.map(p=>p.slice(1));
 if(cross2(subtract2(yz[1],yz[0]),subtract2(yz[2],yz[0]))<0){points=[points[0],points[2],points[1]];yz=points.map(p=>p.slice(1));}
 const a=points[0],b=points[1],c=points[2],det=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
  ay=((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/det,
  az=((b[1]-a[1])*(c[0]-a[0])-(c[1]-a[1])*(b[0]-a[0]))/det,
  plane=[ay,az,a[0]-ay*a[1]-az*a[2]],first=Math.atan2(yz[0][1],yz[0][0]),
  angles=yz.map(p=>first+Math.atan2(Math.sin(Math.atan2(p[1],p[0])-first),Math.cos(Math.atan2(p[1],p[0])-first)));
 let radiusMin=Infinity;
 for(let i=0;i<3;i++){
  const p=yz[i],d=subtract2(yz[(i+1)%3],p),t=Math.max(0,Math.min(1,-dot2(p,d)/dot2(d,d)));
  radiusMin=Math.min(radiusMin,Math.hypot(p[0]+d[0]*t,p[1]+d[1]*t));
 }
 return{id,points:yz,plane,angleMin:Math.min(...angles),angleMax:Math.max(...angles),radiusMin,
  radiusMax:Math.max(...yz.map(p=>Math.hypot(...p))),box:[Math.min(...yz.map(p=>p[0])),Math.max(...yz.map(p=>p[0])),Math.min(...yz.map(p=>p[1])),Math.max(...yz.map(p=>p[1]))]};
}
function front(mesh){
 const g=mesh.geometry,p=g.attributes.position,start=g.userData.frontTriangleStart,count=g.userData.frontTriangleCount,result=[];
 if(!(count>0))throw Error('Missing native jaw front');
 for(let i=start;i<start+count;i++){
  const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i*3+j).applyMatrix4(mesh.matrixWorld).toArray());
  result.push(describe(points,i));
 }
 return result;
}
function intersect(subject,clip){
 let result=subject;
 for(let i=0;i<3&&result.length;i++){
  const a=clip[i],d=subtract2(clip[(i+1)%3],a),next=[];
  for(let j=0;j<result.length;j++){
   const p=result[j],q=result[(j+1)%result.length],dp=cross2(d,subtract2(p,a)),dq=cross2(d,subtract2(q,a));
   if(dp>=-1e-15)next.push(p);
   if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  }
  result=next;
 }
 return result;
}

// Native opposing jaw fronts are height fields over the shaft-normal plane.
// Intersect each projected triangle pair and minimize their affine axial gap
// at every intersection-polygon vertex, including edge/edge crossings. This
// is not a vertex/centroid surface sample or the analytic triangular wave.
export function makeWeightedClutchNativeJawsPruned(model){
 model.setCoordinates([0,0,0,0],0);const u=model.root.userData,pairs={};
 for(const side of ['left','right']){
  const loose=front(u.parts[side+'LooseJaw']),sliding=front(u.parts[side+'SlidingJaw']),buckets=Array.from({length:bins},()=>[]);
  for(let i=0;i<loose.length;i++){
   const t=loose[i];for(let j=Math.floor(t.angleMin/tau*bins);j<=Math.floor(t.angleMax/tau*bins);j++)buckets[mod(j)].push(i);
  }
  pairs[side]={loose,sliding,buckets};
 }
 function evaluate(side,relativeAngle,clutchShift=0){
  if(!pairs[side]||![relativeAngle,clutchShift].every(Number.isFinite))throw Error('Invalid jaw query');
  const {loose,sliding,buckets}=pairs[side],angle=Math.atan2(Math.sin(relativeAngle),Math.cos(relativeAngle)),sign=side==='left'?1:-1,
   seen=new Int32Array(loose.length);let serial=0,gap=Infinity,witness=null,tested=0,intersections=0,pruned=0;
  for(const b of sliding){
   serial++;const points=b.points.map(p=>rotate2(p,angle)),coeff=rotate2(b.plane.slice(0,2),angle),plane=[...coeff,b.plane[2]],
    box=[Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1]))];
   for(let bin=Math.floor((b.angleMin+angle)/tau*bins);bin<=Math.floor((b.angleMax+angle)/tau*bins);bin++)for(const index of buckets[mod(bin)]){
    if(seen[index]===serial)continue;seen[index]=serial;const a=loose[index];
    if(a.radiusMax<b.radiusMin-1e-12||b.radiusMax<a.radiusMin-1e-12||a.box[0]>box[1]||a.box[1]<box[0]||a.box[2]>box[3]||a.box[3]<box[2])continue;
    tested++;
    // The gap is affine on a triangle pair. Its minimum on their
    // intersection cannot be below either whole-triangle minimum.
    // Skip clipping only when that conservative bound exceeds the best
    // measured gap, including a roundoff cushion for these model units.
    const gx=sign*(plane[0]-a.plane[0]),gy=sign*(plane[1]-a.plane[1]),gc=sign*(plane[2]+clutchShift-a.plane[2]),
      lower=gc+Math.max(minimumAffine(points,gx,gy),minimumAffine(a.points,gx,gy));
    if(lower>gap+1e-12){pruned++;continue;}
    const overlap=intersect(points,a.points);if(!overlap.length)continue;intersections++;
    for(const point of overlap){
     const xa=height(a.plane,point),xb=height(plane,point)+clutchShift,d=sign*(xb-xa);
     if(d<gap){gap=d;witness={looseTriangle:a.id,slidingTriangle:b.id,pointLoose:[xa,...point],pointSliding:[xb,...point],radius:Math.hypot(...point)};}
    }
   }
  }
  if(!Number.isFinite(gap))throw Error('Native jaw projections do not overlap');
  return{side,relativeAngle,clutchShift,gap,witness,tested,intersections,pruned};
 }
 return{evaluate,parameters:{fronts:Object.fromEntries(Object.entries(pairs).map(([side,p])=>[side,{loose:p.loose.length,sliding:p.sliding.length}])),
  qualification:'Minimum axial clearance over intersections of actual Float32 front triangles, with conservative affine whole-triangle lower bounds pruning clips that cannot improve the current minimum. Left relative angle is output minus 1.4 input; right is output plus 1.4 input. Includes finite radial grids and keyed bores. Contact witnesses use the loose-gear reference frame, with its world spin removed.'}};
}
