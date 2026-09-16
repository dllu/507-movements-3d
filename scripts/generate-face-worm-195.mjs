import fs from 'node:fs';
import * as THREE from 'three';
import {makeSolidWorm} from '../src/simulation/solid-worm.js';
// Sweep the actual triangulated visible worm, not its pitch cylinder. The
// upper wheel's front is the lower Z envelope of this synchronized cutter.
const p={teeth:24,innerRadius:.84,outerRadius:1.22,back:-.36,radialSteps:24,angularSteps:64,phaseSteps:2400,sweep:24,clearance:.0035};
const pitch=2*Math.PI/p.teeth,worm=makeSolidWorm({length:5*2*Math.PI*.98/24,radius:.16,pitch:2*Math.PI*.98/24,shaftRadius:.067});
const geo=worm.userData.thread.geometry,src=geo.attributes.position,heights=new Float64Array((p.radialSteps+1)*(p.angularSteps+1)),verts=new Float64Array(src.count*3);
const points=Array.from({length:heights.length},(_,i)=>{const r=p.innerRadius+(p.outerRadius-p.innerRadius)*Math.floor(i/(p.angularSteps+1))/p.radialSteps,a=-pitch/2+pitch*(i%(p.angularSteps+1))/p.angularSteps;return[r*Math.cos(a),r*Math.sin(a)];});
const v=new THREE.Vector3(),inv=new THREE.Matrix4(),m=new THREE.Matrix4();
for(let step=0;step<=p.phaseSteps;step++){
 const q=-p.sweep+2*p.sweep*step/p.phaseSteps;
 worm.userData.rotor.rotation.z=-5*Math.PI+q;worm.updateMatrixWorld(true);
 inv.makeRotationZ(Math.PI/2+q/24);m.makeTranslation(0,-1.14,0);inv.multiply(m).multiply(worm.userData.thread.matrixWorld);
 for(let i=0;i<src.count;i++){v.fromBufferAttribute(src,i).applyMatrix4(inv);verts.set(v.toArray(),i*3);}
 for(let i=0;i<verts.length;i+=9){
  const ax=verts[i],ay=verts[i+1],az=verts[i+2],bx=verts[i+3],by=verts[i+4],bz=verts[i+5],cx=verts[i+6],cy=verts[i+7],cz=verts[i+8];
  if(Math.min(az,bz,cz)>p.clearance||Math.max(ax,bx,cx)<=0)continue;
  const xmin=Math.min(ax,bx,cx),xmax=Math.max(ax,bx,cx),ymin=Math.min(ay,by,cy),ymax=Math.max(ay,by,cy);
  if(ymin>xmax*Math.tan(pitch/2)||ymax< -xmax*Math.tan(pitch/2))continue;
  const rmin=Math.hypot(Math.max(0,xmin),ymin>0?ymin:ymax<0?ymax:0),rmax=Math.max(Math.hypot(ax,ay),Math.hypot(bx,by),Math.hypot(cx,cy));
  const r0=Math.max(0,Math.floor((rmin-p.innerRadius)/(p.outerRadius-p.innerRadius)*p.radialSteps)),r1=Math.min(p.radialSteps,Math.ceil((rmax-p.innerRadius)/(p.outerRadius-p.innerRadius)*p.radialSteps));
  const det=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(det)<1e-14)continue;
  for(let r=r0;r<=r1;r++)for(let a=0;a<=p.angularSteps;a++){
   const idx=r*(p.angularSteps+1)+a,[x,y]=points[idx];if(x<xmin||x>xmax||y<ymin||y>ymax)continue;
   const u=((x-ax)*(cy-ay)-(y-ay)*(cx-ax))/det,w=((bx-ax)*(y-ay)-(by-ay)*(x-ax))/det;
   if(u>=-1e-10&&w>=-1e-10&&u+w<=1+1e-10)heights[idx]=Math.min(heights[idx],az+u*(bz-az)+w*(cz-az)-p.clearance);
  }
 }
}
// Conservative local envelope compensates finite grid interpolation at valleys.
const raw=heights.slice();for(let r=0;r<=p.radialSteps;r++)for(let a=0;a<=p.angularSteps;a++)for(let dr=-1;dr<=1;dr++)for(let da=-1;da<=1;da++){
 const rr=Math.max(0,Math.min(p.radialSteps,r+dr)),aa=(a+da+p.angularSteps)%p.angularSteps;heights[r*(p.angularSteps+1)+a]=Math.min(heights[r*(p.angularSteps+1)+a],raw[rr*(p.angularSteps+1)+aa]);
}
for(let r=0;r<=p.radialSteps;r++)heights[r*(p.angularSteps+1)+p.angularSteps]=heights[r*(p.angularSteps+1)];
if(Math.min(...heights)<p.back+.02)throw Error('Cutter breaches backing');
const data={...p,heights:Array.from(heights,x=>+x.toFixed(8))},text=`// Actual solid-worm swept face profile; scripts/generate-face-worm-195.mjs.\nexport default ${JSON.stringify(data)};\n`,file='src/data/face-worm-195.js';
if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Bake differs');}else fs.writeFileSync(file,text);
console.log({samples:heights.length,min:Math.min(...heights),max:Math.max(...heights),bytes:text.length});
