import {polygonClipping,poly} from '../../src/simulation/finite-plate-geometry.js';
import * as THREE from 'three';

// Independent finite segment/circle and segment/polygon contact audit.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function pointSegment(p,a,b){const e=sub(b,a),q=sub(p,a),u=Math.min(1,Math.max(0,dot(q,e)/dot(e,e)));return[a[0]+u*e[0],a[1]+u*e[1]]}
function segmentDistance(a,b,c,d){let best={gap:Infinity};for(const [p,u,v,flip] of [[a,c,d,0],[b,c,d,0],[c,a,b,1],[d,a,b,1]]){const q=pointSegment(p,u,v),gap=Math.hypot(...sub(p,q));if(gap<best.gap)best={gap,p:flip?q:p,q:flip?p:q};}return best;}
const area=ps=>ps.reduce((a,p)=>a+p.reduce((a,r)=>a+Math.abs(r.reduce((a,q,i)=>a+cross(q,r[(i+1)%r.length]),0))/2,0),0);
export function auditMangleRackProfile(m, id, samples = 256) {
const d=m.root.userData,g=d.geometry,b=d.blocks,gear=b.pinion.userData.rotor.children[0];
const profile=gear.geometry.userData.plate.polygons[0][0].map(p=>p.map(Math.fround)),by={};
for(let i=0;i<=samples;i++){
 const t=d.transmission.cyclePeriod*i/samples;m.update(t);m.root.updateMatrixWorld(true);const s=d.kinematics,inv=gear.matrixWorld.clone().invert();let gap=Infinity,driveGap=Infinity,driveMoment=0,overlap=0;
 if(id===197){for(const pin of b.rackPins){const v=pin.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv),p=[v.x,v.y];if(Math.hypot(...p)>1)continue;for(let j=0;j<profile.length-1;j++){const q=pointSegment(p,profile[j],profile[j+1]),delta=sub(q,p),distance=Math.hypot(...delta),clearance=distance-g.rackPinRadius;gap=Math.min(gap,clearance);const moment=cross(q,delta)/distance;if(moment>.025&&clearance<driveGap){driveGap=clearance;driveMoment=moment;}}}}
 else{for(const tooth of b.rackTeeth){const matrix=inv.clone().multiply(tooth.matrixWorld),points=tooth.geometry.userData.plate.polygons[0][0].map(p=>{const v=new THREE.Vector3(Math.fround(p[0]),Math.fround(p[1]),0).applyMatrix4(matrix);return[v.x,v.y]});if(Math.min(...points.map(p=>Math.hypot(...p)))>.7)continue;overlap+=area(polygonClipping.intersection(poly(profile),poly(points)));for(let j=0;j<points.length-1;j++)for(let k=0;k<profile.length-1;k++){const result=segmentDistance(profile[k],profile[k+1],points[j],points[j+1]);gap=Math.min(gap,result.gap);const delta=sub(result.p,result.q),moment=cross(result.p,delta)/(result.gap||1);if(moment>.025&&result.gap<driveGap){driveGap=result.gap;driveMoment=moment;}}}}
 const key=s.pathSegment;by[key]??={minGap:Infinity,maxGap:0,maxDriveGap:0,minDriveMoment:Infinity,maxOverlap:0};const a=by[key];a.minGap=Math.min(a.minGap,gap);a.maxGap=Math.max(a.maxGap,gap);if(driveGap>a.maxDriveGap){a.maxDriveGap=driveGap;a.witness=i/samples}a.minDriveMoment=Math.min(a.minDriveMoment,driveMoment);a.maxOverlap=Math.max(a.maxOverlap,overlap);
}
return by;
}
