import * as THREE from 'three';
import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeBellCrankPhysics(mujoco,visual,{timestep=.001,period=4,friction=.8,load=2,gravity=9.81,contactTime=.004,connectionTime=.004,iterations=60,ropeDensity=null,solver='Newton',planarCord=false}={}){
 if(![timestep,period,contactTime,connectionTime].every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(friction)||friction<0||![load,gravity].every(Number.isFinite)||!Number.isInteger(iterations)||iterations<1||(ropeDensity!==null&&!(ropeDensity>0&&Number.isFinite(ropeDensity))))throw new RangeError('Invalid 126 physics options');
 if(typeof planarCord!=='boolean'||!['Newton','CG','PGS'].includes(solver))throw new RangeError('Invalid 126 solver');
 const u=visual.root.userData,f=u.profile,masses=Object.fromEntries(['bell','pulley'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/masses.bell.volume,cordDensity=ropeDensity??.12*density;
 const inertial=n=>{const m=masses[n];return`<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const sections=[],connections=[],exclusions=[],cords={};
 const contact=`condim="${friction?3:1}" friction="${friction} .001 .001" solref="${contactTime} 1" solimp=".99 .999 .001"`;
 function connect(a,b){connections.push({a,b,xml:`<connect site1="${a}" site2="${b}" solref="${connectionTime} 1" solimp=".99999 .99999 .001"/>`});}
 for(const[name,points,start,end]of [['input',f.inputPath.points,'inputEnd','inputPin'],['output',f.outputPoints,'outputPin','outputEnd']]){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,k)=>v-points[i][k]))),radius=f.cordRadius;
  const localNeighbours=Math.ceil(2.2*radius/Math.min(...lengths))+1;
  for(let i=0;i<lengths.length;i++){
   const a=new THREE.Vector3(...points[i]),b=new THREE.Vector3(...points[i+1]),length=lengths[i],center=a.clone().add(b).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),b.clone().sub(a).normalize());
   const mass=Math.PI*radius**2*length*cordDensity,transverse=mass*(3*radius**2+length**2)/12,axial=mass*radius**2/2,n=name+i;
   const inverse=q.clone().invert(),planeAxis=v=>vec(new THREE.Vector3(...v).applyQuaternion(inverse).toArray());
   const joints=planarCord?`<joint name="${n}x" type="slide" axis="${planeAxis([1,0,0])}"/><joint name="${n}y" type="slide" axis="${planeAxis([0,1,0])}"/><joint name="${n}j" type="hinge" axis="${planeAxis([0,0,1])}"/>`:`<freejoint name="${n}j"/>`;
   sections.push(`<body name="${n}" pos="${vec(center.toArray())}" quat="${vec([q.w,q.x,q.y,q.z])}">${joints}<inertial pos="0 0 0" mass="${mass}" diaginertia="${vec([transverse,transverse,axial])}"/><geom name="${n}g" type="capsule" size="${radius} ${length/2}" contype="2" conaffinity="3" ${contact}/><site name="${n}a" pos="0 0 ${-length/2}"/><site name="${n}b" pos="0 0 ${length/2}"/></body>`);
   if(i)connect(name+(i-1)+'b',n+'a');
   for(let j=Math.max(0,i-localNeighbours);j<i;j++)exclusions.push(`<exclude body1="${name+j}" body2="${n}"/>`);
  }
  connect(start,name+'0a');connect(name+(lengths.length-1)+'b',end);
  cords[name]={lengths,localNeighbours};
 }
 const xml=`<mujoco model="126 native pulley and bell crank"><compiler angle="radian" inertiafromgeom="false"/>
<option timestep="${timestep}" gravity="0 ${-gravity} 0" integrator="implicitfast" solver="${solver}" iterations="${iterations}" tolerance="1e-9" ccd_tolerance="1e-10" cone="elliptic"/><size memory="64M"/>
<worldbody><body name="pulley" pos="${vec(f.centers.pulley)}"><joint name="spin" axis="0 0 1" damping=".005"/>${inertial('pulley')}
<geom name="drum" type="cylinder" size="${f.drumRadius} .10" contype="1" conaffinity="2" ${contact}/>
<geom name="front" type="cylinder" size="${u.source.circles.pulleyRim.radius/100} .02" pos="0 0 .12" contype="1" conaffinity="2" ${contact}/>
<geom name="back" type="cylinder" size="${u.source.circles.pulleyRim.radius/100} .02" pos="0 0 -.12" contype="1" conaffinity="2" ${contact}/></body>
<body name="bell"><joint name="bell" axis="0 0 1" damping=".02"/>${inertial('bell')}<site name="inputPin" pos="${vec(f.inputPin)}"/><site name="outputPin" pos="${vec(f.outputPin)}"/></body>
<body name="inputHandle" pos="${vec(f.inputEnd)}"><joint name="drive" type="slide" axis="${vec(f.inputPath.direction)}"/><inertial pos="0 0 0" mass=".02" diaginertia=".00001 .00001 .00001"/><site name="inputEnd"/></body>
<body name="outputHandle" pos="${vec(f.outputEnd)}"><joint name="output" type="slide" axis="${vec(f.outputDirection)}"/><inertial pos="0 0 0" mass=".1" diaginertia=".00001 .00001 .00001"/><site name="outputEnd"/></body>
${sections.join('\n')}</worldbody><contact>${exclusions.join('')}</contact><equality>${connections.map(c=>c.xml).join('')}</equality><actuator><position joint="drive" kp="10000" kv="200"/></actuator></mujoco>`;
 const omega=2*Math.PI/period,input=time=>{const ramp=1-Math.exp(-((time/.25)**2)),dr=2*time/.25**2*Math.exp(-((time/.25)**2));return{position:f.amplitude*Math.sin(omega*time)*ramp,velocity:f.amplitude*(omega*Math.cos(omega*time)*ramp+Math.sin(omega*time)*dr)};};
 const p=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{data.qfrc_applied[model.jnt_dofadr[id('mjOBJ_JOINT','output')]]=load;},beforeStep:({data,time})=>{const q=input(time);data.ctrl[0]=q.position+.02*q.velocity;}});
 const joints=Object.fromEntries(['spin','bell','drive','output'].map(n=>{const id=p.id('mjOBJ_JOINT',n);return[n,{q:p.model.jnt_qposadr[id],v:p.model.jnt_dofadr[id]}];}));
 for(const[name,c]of Object.entries(cords))c.ends=c.lengths.map((_,i)=>['a','b'].map(s=>p.id('mjOBJ_SITE',name+i+s)));
 const site=id=>Array.from(p.data.site_xpos.slice(3*id,3*id+3));
 const getCordPoints=name=>{const ends=cords[name].ends;return[site(ends[0][0]),...ends.slice(1).map(([a],i)=>site(a).map((v,k)=>(v+p.data.site_xpos[3*ends[i][1]+k])/2)),site(ends.at(-1)[1])];};
 return Object.assign(p,{joints,cords,getCordPoints,connections:connections.map(c=>[c.a,c.b].map(n=>p.id('mjOBJ_SITE',n))),bodies:Object.fromEntries(['bell','pulley'].map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{xml,input,masses,density,cordDensity,options:{timestep,period,friction,load,gravity,contactTime,connectionTime,iterations,ropeDensity,solver,planarCord},assumptions:'One driven input endpoint; passive pulley, lever and loaded output endpoint. Finite cord sections use native ball connections, friction and nonlocal self-contact. Optional planar reduction retains in-plane translation and rotation and constrains each cord to its source plane; the full 3D model permits all six section coordinates. Local overlapping capsule caps are excluded, and mass partitions cylindrical material. Ideal fixed bearings, source-tangent endpoint guides, concealed rigid pin clamps, uniform metal density normalized to unit lever mass, rope density 12% of metal by default, loads and drive timing are reconstructed. No bending stiffness or prescribed output motion.'}});
}
