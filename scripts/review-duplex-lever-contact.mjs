// Read-only diagnostic of the retained, unqualified working interfaces.
import fs from 'node:fs';
import * as THREE from 'three';
import {createAuthoredDuplexEscapementMovement as duplex} from '../src/simulation/authored-duplex-escapements.js';
import {createAuthoredLeverEscapementMovement as lever} from '../src/simulation/authored-lever-escapements.js';
import {surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';
const report=[];
for(const[id,create]of[[293,duplex],[296,lever]]){
 const m=create({id}),d=m.root.userData,b=d.blocks;
 const sets=id===293?[
  {name:'long teeth / notched roller',pairs:b.lockingToothMeshes.map(t=>[t,b.lockingRoller])},
  {name:'crown pins / impulse pallet',pairs:b.impulsePins.map(t=>[t,b.impulsePalletBody])},
 ]:[{name:'balance pin / fork tines',pairs:b.forkTines.map(t=>[b.impulsePin,t])}];
 const points=new Map(),solids=new Map();for(const set of sets)for(const[a,b]of set.pairs){if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));if(!solids.has(b.geometry))solids.set(b.geometry,solidSurface(b.geometry));}
 const metrics=sets.map(s=>({name:s.name,minimumSignedGap:.2,worstPhase:null,queries:0})),point=new THREE.Vector3();
 for(let i=0;i<=64;i++){
  const phase=i/64;m.update(d.geometry.balancePeriod*phase);m.root.updateMatrixWorld(true);
  for(let j=0;j<sets.length;j++)for(const[a,b]of sets[j].pairs){const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);
   for(const v of points.get(a.geometry)){point.copy(v).applyMatrix4(matrix);const gap=solids.get(b.geometry).signedDistance(point,.2);metrics[j].queries++;if(gap<metrics[j].minimumSignedGap){metrics[j].minimumSignedGap=gap;metrics[j].worstPhase=phase;}}
  }
 }
 report.push({id,poses:65,metrics,residual:d.escapementInterfaces.contactResidual});
}
fs.writeFileSync(process.argv[2]??'/dev/shm/duplex-lever-contact-diagnostic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
