import {waveCamProfileAngles} from './adaptive-profile.js';
import {waveCamGeometry,waveCamHeight} from './profile.js';
// Narrow outer contact band. Each cell is compiled by MuJoCo as its convex
// hull, including the small diagonal subdivision of the warped lower face.
export function waveCamContactMeshes({segments=360,clearance=.001,profileTolerance=null}={}){
 const g=waveCamGeometry(),radii=[2.69,2.722,g.outerRadius],meshes=[];
 const angles=profileTolerance===null?Array.from({length:segments+1},(_,i)=>2*Math.PI*i/segments):waveCamProfileAngles({segments,tolerance:profileTolerance});
 for(let i=0;i<angles.length-1;i++)for(let j=0;j<radii.length-1;j++){
  const vertices=[];for(const a of [angles[i],angles[i+1]])for(const r of [radii[j],radii[j+1]])for(const y of [waveCamHeight(a,g)+clearance,g.topY])vertices.push([r*Math.sin(a),y,r*Math.cos(a)]);
  meshes.push({name:'wave-'+i+'-'+j,vertices});
 }
 return{geometry:g,meshes,segments:angles.length-1,clearance,profileTolerance};
}
