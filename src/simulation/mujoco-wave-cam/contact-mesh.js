import {waveCamGeometry,waveCamHeight} from './profile.js';
// Narrow outer contact band. Each cell is compiled by MuJoCo as its convex
// hull, including the small diagonal subdivision of the warped lower face.
export function waveCamContactMeshes({segments=360,clearance=.001}={}){
 const g=waveCamGeometry(),radii=[2.69,2.722,g.outerRadius],meshes=[];
 for(let i=0;i<segments;i++)for(let j=0;j<radii.length-1;j++){
  const vertices=[];for(const a of [2*Math.PI*i/segments,2*Math.PI*(i+1)/segments])for(const r of [radii[j],radii[j+1]])for(const y of [waveCamHeight(a,g)+clearance,g.topY])vertices.push([r*Math.sin(a),y,r*Math.cos(a)]);
  meshes.push({name:'wave-'+i+'-'+j,vertices});
 }
 return{geometry:g,meshes,segments,clearance};
}
