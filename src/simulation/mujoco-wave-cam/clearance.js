import {waveCamProjectedHeight} from './projected-profile.js';
import {waveCamGeometry,waveCamHeight} from './profile.js';
// Sample the continuous face independently of MuJoCo's convex hulls. Include
// the exact annulus/roller axial-edge boundary, where this narrow roller contacts.
export function waveCamSampledGap(s,{samples=256,geometry:g=waveCamGeometry(),profileType='radial'}={}){
 const zmin=g.rollerZ-g.rollerDepth/2,limit=Math.sqrt(g.outerRadius**2-zmin**2);
 const xmin=Math.max(-limit,s.rollerCenter[0]-g.rollerRadius),xmax=Math.min(limit,s.rollerCenter[0]+g.rollerRadius);
 let gap=Infinity,point;
 for(let i=0;i<=samples;i++){
  const x=xmin+(xmax-xmin)*i/samples,hi=Math.min(g.rollerZ+g.rollerDepth/2,Math.sqrt(Math.max(0,g.outerRadius**2-x*x)));
  for(let j=0;j<=8;j++){
   const z=zmin+(hi-zmin)*j/8,height=profileType==='projected'?waveCamProjectedHeight(x*Math.cos(s.cam)-z*Math.sin(s.cam),g):waveCamHeight(Math.atan2(x,z)-s.cam,g),top=s.rollerCenter[1]+Math.sqrt(Math.max(0,g.rollerRadius**2-(x-s.rollerCenter[0])**2));
   if(height-top<gap){gap=height-top;point=[x,height,z];}
  }
 }
 return{gap,point};
}
