import {THREE} from './weighted-clutch-key-candidate.mjs';
import {familyMass} from '../../src/simulation/finite-plate-geometry.js';

// D and the shaft have separate spin coordinates. The eccentric feather and
// stud therefore cannot be represented by a single output-angle potential.
export function makeWeightedClutchSplitGravity(model,inertia){
 const u=model.root.userData,cache=new Map(),components=Object.entries(u.parts)
  .filter(([name])=>['D','shaft','pinion','E'].includes(u.families[name])).map(([name,mesh])=>{
   if(!cache.has(mesh.geometry))cache.set(mesh.geometry,familyMass({part:new THREE.Mesh(mesh.geometry)},{part:'body'},'body'));
   const raw=cache.get(mesh.geometry),family=u.families[name];
   return{name,mesh,group:family==='D'?'D':family==='E'?'E':'shaft',center:raw.centroid,mass:raw.volume*inertia.parameters.density};
  });
 function nativePotential(shaftAngle,clutchAngle,group=null){
  model.setCoordinates([0,0,0,shaftAngle,clutchAngle],0);
  return components.reduce((s,c)=>s+(group&&c.group!==group?0:c.mass*inertia.parameters.gravity*
   new THREE.Vector3(...c.center).applyMatrix4(c.mesh.matrixWorld).y),0);
 }
 const waves=['D','shaft','E'].map(group=>{
  const frequency=group==='E'?1/u.geometry.eRatio:1,
   values=[0,1,2,3].map(i=>nativePotential(i*Math.PI/2/frequency,i*Math.PI/2/frequency,group));
  return{group,coordinate:group==='D'?4:3,frequency,constant:(values[0]+values[2])/2,
   cosine:(values[0]-values[2])/2,sine:(values[1]-values[3])/2};
 });
 function at(shaftAngle,clutchAngle){
  const result={potential:0,gradient:[0,0,0,0,0],diagonalHessian:[0,0,0,0,0]};
  for(const w of waves){
   const angle=w.coordinate===4?clutchAngle:shaftAngle,c=Math.cos(w.frequency*angle),s=Math.sin(w.frequency*angle);
   result.potential+=w.constant+w.cosine*c+w.sine*s;
   result.gradient[w.coordinate]+=w.frequency*(-w.cosine*s+w.sine*c);
   result.diagonalHessian[w.coordinate]-=w.frequency**2*(w.cosine*c+w.sine*s);
  }
  return result;
 }
 return{at,nativePotential,parameters:{waves,components:components.map(({mesh,...c})=>c),
  qualification:'Separate native-centroid gravity for D, shaft/pinion and E, using the existing illustrative additive-component density. D translation is horizontal. No counterweight or friction force is hidden in the potential.'}};
}
