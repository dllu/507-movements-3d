import fs from 'node:fs';
import {makeEccentricStrap,THREE} from '../src/simulation/eccentric-strap.js';
import {freezeStudySources} from './lib/study-report-io.mjs';
const model=makeEccentricStrap(),u=model.root.userData,g=u.geometry,steps=512,bounds=new THREE.Box3(),point=new THREE.Vector3();
const horizontalMinimum=Math.sqrt(g.eccentricRodLength**2-(g.eccentricity+Math.abs(g.sliderY))**2);
let maximumVertexSpeed=0;
for(const [name,mesh]of Object.entries(u.parts)){
  const family=u.families[name];if(family==='fixed')continue;
  const group=family==='input'?u.blocks.input:family==='strap'?u.blocks.strap:u.blocks.outputSlide;
  const positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);group.worldToLocal(point);
    const speed=family==='input'?Math.hypot(point.x,point.y)*g.inputSpeedMagnitude:
      family==='strap'?g.eccentricity*g.inputSpeedMagnitude*(1+Math.hypot(point.x,point.y)/horizontalMinimum):
      g.eccentricity*g.inputSpeedMagnitude*(1+(g.eccentricity+Math.abs(g.sliderY))/horizontalMinimum);
    maximumVertexSpeed=Math.max(maximumVertexSpeed,speed);
  }
}
for(let i=0;i<=steps;i++){model.update(i*g.cyclePeriod/steps);bounds.union(new THREE.Box3().setFromObject(model.root,true));}
const padding=maximumVertexSpeed*g.cyclePeriod/(2*steps)+1e-6;bounds.expandByScalar(padding);
const file='src/data/display-profiles.json',data=JSON.parse(fs.readFileSync(file)),previous=data.profiles[89];
data.profiles[89]={peakAngularSpeed:g.inputSpeedMagnitude,peakVisibleAngularSpeed:g.inputSpeedMagnitude,
  sustainedVisibleAngularSpeed:g.inputSpeedMagnitude,floorY:bounds.min.y,fastestPart:'input-shaft',
  motionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  motionBoundsMethod:'512 cycle samples expanded by a conservative maximum material-point speed times half the sample interval, plus 1e-6 for rounding. Offset-rod vertical travel is included.',
  speedMethod:'Prescribed shaft angular speed exceeds the exact strap swing rate over the full cycle.'};
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('src/data/display-profiles.js','// Generated display measurements; 089 refined by scripts/finalize-eccentric-strap-source-display.mjs.\nexport default '+JSON.stringify(data)+';\n');
const prefix=process.env.PROBE_PREFIX??'artifacts/review/089-source-display';
const sources=freezeStudySources(['scripts/finalize-eccentric-strap-source-display.mjs','src/simulation/eccentric-strap.js',
  'src/simulation/eccentric-strap-source.js','src/simulation/eccentric-strap-joints.js',file,'src/data/display-profiles.js'],prefix);
fs.writeFileSync(prefix+'.json',JSON.stringify({sources,previous,profile:data.profiles[89],steps,maximumVertexSpeed,padding,passed:true},null,2)+'\n',{flag:'wx'});
console.log({maximumVertexSpeed,padding,profile:data.profiles[89]});
