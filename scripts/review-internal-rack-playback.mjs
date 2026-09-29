import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {makeInternalRackGeometry} from '../src/simulation/mujoco-internal-rack/geometry.js';
import {internalRackPitchDimensions} from '../src/simulation/mujoco-internal-rack/profile.js';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const asset='src/simulation/baked/assets/139.json.gz',b=JSON.parse(gunzipSync(fs.readFileSync(asset)));
const orbit=internalRackPitchDimensions().orbit;
const v=makeInternalRackGeometry(JSON.parse(fs.readFileSync('/dev/shm/139-generated-profile.json'))),parts=v.root.userData.parts;
const body=parts['steel-tooth-rim'].geometry.userData.plate.polygons,pinion=parts['pinion-teeth'].geometry.userData.plate.polygons;
const area=p=>p.reduce((sum,p)=>sum+p.reduce((sum,r,k)=>{let a=0;for(let i=0;i<r.length;i++){const z=r[(i+1)%r.length];a+=r[i][0]*z[1]-z[0]*r[i][1];}return sum+(k===0?1:-1)*Math.abs(a)/2;},0),0);
let maximumOverlapSquarePixels=0,maximumAt=0;
try{
 for(let i=0;i<1600;i++){
  const time=(i+.371)*b.loopEnd/1600,[a,x,y]=sampleBakedMotion(b,time),c=Math.cos(a),s=Math.sin(a);
  const transformed=pinion.map(p=>p.map(r=>r.map(([px,py])=>[c*px-s*py-x+.05,s*px+c*py-y-orbit])));
  const overlap=area(clip.intersection(body,transformed))*10000;
  if(overlap>maximumOverlapSquarePixels){maximumOverlapSquarePixels=overlap;maximumAt=time;}
 }
 const report={samples:1600,maximumOverlapSquarePixels,maximumAt,note:'Intersection area of finite rendered tooth contours at between-recording times; native soft-contact penetration is separately recorded. Area is not a penetration-depth bound.',sources:[asset,'src/simulation/mujoco-internal-rack/geometry.js','scripts/review-internal-rack-playback.mjs'].map(file=>({file,sha256:hash(file)}))};
 fs.writeFileSync('docs/validation/139-playback-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(v.root);}
