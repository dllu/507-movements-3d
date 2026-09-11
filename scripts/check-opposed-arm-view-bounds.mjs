import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {opposedArmViewBounds} from './lib/opposed-arm-view-bounds.mjs';
const model=makeOpposedArmCandidate(),u=model.root.userData,p=u.geometry,bounds=opposedArmViewBounds(model),byName=Object.fromEntries(bounds.parts.map(p=>[p.name,p])),
 issues=[],sources=[];let checks=0,minimumMargin=Infinity;
for(let i=0;i<=100;i++){
 u.setState({sliderX:p.sourceSlider[0]-p.stroke+2*p.stroke*i/100,theta:i*.217,upperBeta:i*.271,lowerBeta:-i*.357});
 for(const [name,mesh]of Object.entries(u.parts)){
  const pos=mesh.geometry.attributes.position,box=byName[name];
  for(let j=0;j<pos.count;j++){
   const point=new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld).toArray();checks++;
   for(let k=0;k<3;k++){const margin=Math.min(point[k]-box.min[k],box.max[k]-point[k]);minimumMargin=Math.min(minimumMargin,margin);if(margin< -1e-10)issues.push({i,name,vertex:j,axis:k,margin});}
  }
 }
}
for(const file of ['scripts/check-opposed-arm-view-bounds.mjs','scripts/lib/opposed-arm-view-bounds.mjs','scripts/lib/opposed-arm-candidate.mjs']){
 const bytes=await readFile(file),archive=`artifacts/review/079-view-bounds-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const passed=issues.length===0,report={movement:79,status:'analytic-view-bounds-check',productionChanged:false,mechanicsPassed:false,passed,checks,minimumMargin,bounds,issues,sources,
 qualification:'Analytic enclosures are cross-checked against all actual world-space mesh vertices at 101 slider positions with wheel and pawls making multiple full rotations. These are framing bounds, not contact-clearance bounds.'};
await writeFile('artifacts/review/079-view-bounds.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,checks,minimumMargin,min:bounds.min,max:bounds.max,issues:issues.slice(0,3)});if(!passed)process.exitCode=1;
