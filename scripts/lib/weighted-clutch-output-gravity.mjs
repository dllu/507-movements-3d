import {THREE} from './weighted-clutch-independent-candidate.mjs';
import {familyMass} from '../../src/simulation/finite-plate-geometry.js';

// The stud and shaft feather make the output assembly eccentric. Two native
// rigid groups contribute harmonics: shaft/D/pinion at phi, and E at phi/ratio.
// Determine their coefficients from actual world centroid transforms, keeping
// the same declared additive-component density as the other inertia studies.
export function makeWeightedClutchOutputGravity(model,inertia){
 const u=model.root.userData,cache=new Map(),components=Object.entries(u.parts).filter(([n])=>['D','shaft','pinion','E'].includes(u.families[n])).map(([name,mesh])=>{
  if(!cache.has(mesh.geometry)){const dummy=new THREE.Mesh(mesh.geometry);cache.set(mesh.geometry,familyMass({part:dummy},{part:'body'},'body'));}
  const raw=cache.get(mesh.geometry);return{name,mesh,group:u.families[name]==='E'?'E':'shaft',center:raw.centroid,mass:raw.volume*inertia.parameters.density};
 });
 const nativePotential=(phi,group=null)=>{
  model.setCoordinates([0,0,0,phi],0);
  return components.reduce((s,c)=>s+(group&&c.group!==group?0:c.mass*inertia.parameters.gravity*new THREE.Vector3(...c.center).applyMatrix4(c.mesh.matrixWorld).y),0);
 };
 const waves=['shaft','E'].map(group=>{
  const frequency=group==='E'?1/u.geometry.eRatio:1,values=[0,1,2,3].map(i=>nativePotential(i*Math.PI/2/frequency,group));
  return{group,frequency,constant:(values[0]+values[2])/2,cosine:(values[0]-values[2])/2,sine:(values[1]-values[3])/2};
 });
 const at=phi=>waves.reduce((r,w)=>{
  const c=Math.cos(w.frequency*phi),s=Math.sin(w.frequency*phi);
  r.potential+=w.constant+w.cosine*c+w.sine*s;
  r.derivative+=w.frequency*(-w.cosine*s+w.sine*c);
  r.second-=w.frequency**2*(w.cosine*c+w.sine*s);return r;
 },{potential:0,derivative:0,second:0});
 return {at,nativePotential,parameters:{waves,components:components.map(({mesh,...c})=>c),
  qualification:'Gravity potential of actual native output-body centroids, including the eccentric E stud and shaft feather. D translation is along the horizontal shaft and contributes no gravitational term. No output counterweight is assumed.'}};
}
