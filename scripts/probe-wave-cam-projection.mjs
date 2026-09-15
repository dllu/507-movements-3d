import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {makeWaveCamSolids} from '../src/simulation/mujoco-wave-cam/solids.js';
import {waveCamTraceY} from '../src/simulation/mujoco-wave-cam/profile.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
const v=makeWaveCamSolids(),g=v.root.userData.geometry;
try{
 const triangles=['wavedCam','camWeb','rollerWheel'].flatMap(name=>{const mesh=v.root.userData.parts[name];return surfaceTriangles(mesh.geometry).map(t=>({points:[t.a,t.b,t.c].map(p=>p.applyMatrix4(mesh.matrixWorld))}));});
 const rows=[];let maximum=0,sum=0;
 for(let i=1;i<612;i++){
  const pixelX=188+i/2,x=(pixelX-g.axisPixelX)*g.scale,dx=x-g.rollerX,rollerBottom=Math.abs(dx)<g.rollerRadius?g.rollerY-Math.sqrt(g.rollerRadius**2-dx**2):Infinity;
  if(Math.abs(Math.abs(dx)-g.rollerRadius)<.0002)continue;
  const expected=Math.min(g.topY+(177-waveCamTraceY(pixelX))*g.scale,rollerBottom);let actual=Infinity;
  for(const {points:p}of triangles)for(let j=0;j<3;j++){
   const a=p[j],b=p[(j+1)%3];if(x<Math.min(a.x,b.x)||x>Math.max(a.x,b.x))continue;
   if(Math.abs(b.x-a.x)<1e-12){actual=Math.min(actual,a.y,b.y);continue;}
   const u=(x-a.x)/(b.x-a.x);actual=Math.min(actual,a.y+u*(b.y-a.y));
  }
  const errorPixels=(actual-expected)/g.scale;rows.push({pixelX,errorPixels});maximum=Math.max(maximum,Math.abs(errorPixels));sum+=errorPixels**2;
 }
 const sources=['scripts/probe-wave-cam-projection.mjs','src/simulation/mujoco-wave-cam/solids.js','src/simulation/mujoco-wave-cam/adaptive-profile.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco-wave-cam/projected-profile.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:165,status:'whole-solid-front-projection',method:'Project actual cam rim, top web and roller triangles along Z. Compare their union lower silhouette against the independently traced engraving cam and circular source roller, every half source pixel, excluding columns within 0.012 source pixel of an ideal circle tangent (a polygonal silhouette is not a single-valued height there). Includes rear/inner faces; this is separate from the earlier outer-rim profile-only metric.',samples:rows.length,maximumErrorPixels:maximum,rmsErrorPixels:Math.sqrt(sum/rows.length),worst:rows.reduce((a,b)=>Math.abs(a.errorPixels)>Math.abs(b.errorPixels)?a:b),sources};
 fs.writeFileSync('/dev/shm/165-projection-samples.json',JSON.stringify(rows));fs.writeFileSync('docs/validation/165-projection.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{v.dispose();}
