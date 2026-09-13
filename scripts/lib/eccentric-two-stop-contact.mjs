import {nativePlateContours} from './weighted-clutch-native-contours.mjs';

const dot = (a,b) => a[0]*b[0]+a[1]*b[1], cross = (a,b) => a[0]*b[1]-a[1]*b[0];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
const rotate = (p,a) => [p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const area = p => p.reduce((v,a,i) => v+cross(a,p[(i+1)%p.length]),0)/2;
const bounds = p => [Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))];
const normal = (a,b) => {const d=sub(b,a),r=Math.hypot(...d);return [d[1]/r,-d[0]/r];};
const outer = mesh => nativePlateContours(mesh.geometry).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)))[0];

// SAT on the actual Float32 front triangles, including the central bore and
// nonradial offset face. Each triangle is an independent nonpenetration
// constraint, so an internal edge cannot conceal a neighboring overlap.
export function makeEccentricTwoStopContact(model) {
  const u=model.root.userData, cam=outer(u.parts.camA), feet=['C','D'].map(label=>({label,points:outer(u.parts['stop'+label+'Foot'])}));
  if (area(cam)<0) cam.reverse();
  const geometry=u.parts.camA.geometry,position=geometry.attributes.position,triangles=[];
  for(let i=0;i<(geometry.index?.count??position.count);i+=3){
    const ids=[0,1,2].map(j=>geometry.index?geometry.index.getX(i+j):i+j);
    if(!ids.every(j=>Math.abs(position.getZ(j)-u.geometry.camSpan[1])<1e-7))continue;
    const p=ids.map(j=>[position.getX(j),position.getY(j)]);
    triangles.push({points:p,bounds:bounds(p),axes:p.map((a,j)=>normal(a,p[(j+1)%3]))});
  }
  if(!triangles.length)throw Error('Missing native cam face');
  function query(inputAngle,outputAngle,margin=.02) {
    const center=rotate(u.geometry.O,-inputAngle), result=[];
    for(const foot of feet) {
      const vectors=foot.points.map(p=>rotate(p,outputAngle-inputAngle)),points=vectors.map(p=>[p[0]+center[0],p[1]+center[1]]),box=bounds(points);
      const axes=points.map((p,i)=>normal(p,points[(i+1)%points.length]));
      for(let index=0;index<triangles.length;index++) {
        const triangle=triangles[index],b=triangle.bounds;
        if(box[2]<b[0]-margin||box[0]>b[2]+margin||box[3]<b[1]-margin||box[1]>b[3]+margin)continue;
        let gap=-Infinity,witness;
        for(const axis of [...triangle.axes,...axes])for(const sign of [-1,1]) {
          const n=[sign*axis[0],sign*axis[1]];
          let low=Infinity,high=-Infinity,fi=0,ci=0;
          for(let i=0;i<points.length;i++){const v=dot(n,points[i]);if(v<low){low=v;fi=i;}}
          for(let i=0;i<3;i++){const v=dot(n,triangle.points[i]);if(v>high){high=v;ci=i;}}
          if(low-high>gap){gap=low-high;witness={normal:n,footPoint:points[fi],camPoint:triangle.points[ci],
            outputGradient:cross(vectors[fi],n),inputGradient:-cross(triangle.points[ci],n)};}
        }
        if(gap<=margin)result.push({label:foot.label,triangle:index,gap,...witness});
      }
    }
    return result.sort((a,b)=>a.gap-b.gap);
  }
  return {query,parameters:{cam,feet,triangles:triangles.length,O:u.geometry.O,
    qualification:'Native planar triangle/rectangle separation; shaft/bearing clearance and the nonworking body layers need a separate whole-solid check.'}};
}
