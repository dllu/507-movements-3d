import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Fluid, GATE, CHANNEL } from './fluid.js';
import { WaterRenderer } from './water-renderer.js';

const $=id=>document.getElementById(id);
const viewport=$('viewport');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#e6e9e1');
const initialAspect=viewport.clientWidth/viewport.clientHeight;
const camera=new THREE.PerspectiveCamera(initialAspect<1.1?44:36,initialAspect,.1,200);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.075;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=6;controls.maxDistance=22;
const resetCamera=(side=false)=>{
  camera.position.set(...(side?[.05,3.9,12.7]:[6.8,5.2,8.5]));
  controls.target.set(-.1,1.25,0);controls.update();
  fitNarrowViewport();
  $('side').classList.toggle('selected',side);$('perspective').classList.toggle('selected',!side);
};
function fitNarrowViewport(){
  if(camera.aspect>=1.1)return;
  const forward=camera.position.clone().sub(controls.target).normalize();
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
  let distance=camera.position.distanceTo(controls.target);
  for(const x of [-3.9,3.9])for(const y of [-.31,3.7])for(const z of [-1.46,1.46]){
    const relative=new THREE.Vector3(x,y,z).sub(controls.target),depth=relative.dot(forward);
    distance=Math.max(distance,depth+Math.abs(relative.dot(right))*1.12/tanX,depth+Math.abs(relative.dot(up))*1.12/tanY);
  }
  camera.position.copy(controls.target).addScaledVector(forward,distance);controls.update();
}
resetCamera();
const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.5;environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe7f4f2,0x909073,.7));
const sunlight=new THREE.DirectionalLight(0xfff5df,2.0);sunlight.position.set(-3,8,5);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(1536,1536);Object.assign(sunlight.shadow.camera,{left:-6,right:6,top:5,bottom:-5,near:.5,far:22});
sunlight.shadow.normalBias=.025;sunlight.shadow.bias=-.00015;scene.add(sunlight);
const material=(color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const stone=material(0x949b85,.87),cap=material(0xbac0a9,.75),dark=material(0x36463b,.36,.5),brass=material(0xb8a573,.3,.75);
const upperMaterial=material(0xb66345,.35,.22),lowerMaterial=material(0x426e64,.33,.28);
function box(w,h,d,x,y,z,mat,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
box(7.7,.26,2.75,0,-.13,0,stone);
box(7.55,.06,2.60,0,.025,0,cap);
const tileMat=material(0xbabfaa,.9);
for(let x=-3.5;x<=3.5;x+=.5)box(.009,.003,2.22,x,.057,0,tileMat);
for(let z=-1;z<=1.1;z+=.5)box(7.1,.003,.009,0,.057,z,tileMat);
for(const sign of [-1,1]){
  box(7.65,.28,.18,0,.16,sign*1.20,stone);
  box(7.70,.05,.24,0,.325,sign*1.20,cap);
  // Almost invisible flume walls show why the upstream water has straight sides.
  const glass=new THREE.MeshPhysicalMaterial({color:0xc7e3d6,roughness:.15,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide});
  const pane=box(3.7,3.26,.022,-1.85,1.96,sign*1.10,glass);pane.castShadow=false;
  box(.028,3.40,.028,-3.55,1.85,sign*1.10,brass);
  box(3.57,.018,.025,-1.77,3.56,sign*1.10,brass);
  box(.17,1.68,.23,0,.85,sign*1.21,stone);
  box(.22,.055,.28,0,1.71,sign*1.21,cap);
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({color:0xa8b29f,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.285;floor.receiveShadow=true;scene.add(floor);
const upper=new THREE.Group(),lower=new THREE.Group();upper.position.set(GATE.upperX,GATE.upperY,0);lower.position.set(GATE.lowerX,GATE.lowerY,0);scene.add(upper,lower);
box(GATE.thickness,GATE.notchBottom-GATE.upperBottom,GATE.width,0,(GATE.notchBottom+GATE.upperBottom)/2,0,upperMaterial,upper);
const earWidth=(GATE.width-GATE.notchWidth)/2;
for(const s of [-1,1])box(GATE.thickness,GATE.upperTop-GATE.notchBottom,earWidth,0,(GATE.upperTop+GATE.notchBottom)/2,s*(GATE.notchWidth+earWidth)/2,upperMaterial,upper);
box(GATE.thickness,GATE.lowerTop-GATE.lowerBottom,GATE.width,0,(GATE.lowerTop+GATE.lowerBottom)/2,0,lowerMaterial,lower);
for(const y of [GATE.upperBottom+.16,.55])box(.03,.055,GATE.width+.02,GATE.thickness/2+.014,y,0,dark,upper);
for(const y of [-.30,.36])box(.03,.05,GATE.width+.02,GATE.thickness/2+.014,y,0,dark,lower);
for(const [group,pivot] of [[upper,GATE.upperY],[lower,GATE.lowerY]]){
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,2.66,24),dark);axle.rotation.x=Math.PI/2;group.add(axle);
  for(const sign of [-1,1]){
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.13,32),brass);hub.rotation.x=Math.PI/2;hub.position.set(0,0,sign*1.2);group.add(hub);
    const center=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.15,24),dark);center.rotation.x=Math.PI/2;center.position.copy(hub.position);group.add(center);
  }
}
// Discrete level marks on the back pane (meters, identical spacing at every level).
for(let y=.5;y<=3.5;y+=.25)box(y%.5===0?.17:.09,.009,.015,-3.42,y,-1.115,brass);

let fluid=new Fluid('light');
$('quality').value='light';
const water=new WaterRenderer(renderer,camera,fluid.capacity);
let paused=false,renderMode='water',last=performance.now(),accumulator=0,frameCount=0,frameTotal=0,solverTotal=0,lastHud=0;
let lastStatistics=null,ready=false;
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(w/h<1.1){camera.fov=44;}else camera.fov=36;camera.updateProjectionMatrix();
  fitNarrowViewport();
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());water.resize(size.x,size.y);}
new ResizeObserver(resize).observe(viewport);resize();
function showInflow(){ $('inflow-value').textContent=`${Number($('inflow').value).toFixed(2)} m³/s`;fluid.inflow=Number($('inflow').value);}
$('inflow').addEventListener('input',()=>{fluid.floodUntil=0;showInflow();$('normal').classList.remove('selected');$('flood').classList.remove('selected');});
$('gate').addEventListener('input',()=>{fluid.automatic=false;$('automatic').checked=false;fluid.manualAngle=Number($('gate').value)*Math.PI/180;});
$('automatic').addEventListener('change',()=>{fluid.automatic=$('automatic').checked;fluid.manualAngle=Number($('gate').value)*Math.PI/180;});
$('normal').onclick=()=>{fluid.floodUntil=0;fluid.automatic=true;$('automatic').checked=true;$('inflow').value='.28';showInflow();$('normal').classList.add('selected');$('flood').classList.remove('selected');};
$('flood').onclick=()=>{fluid.flood();$('automatic').checked=true;$('flood').classList.add('selected');$('normal').classList.remove('selected');};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶ Resume':'Ⅱ Pause';};
$('reset').onclick=()=>{fluid.reset();paused=false;accumulator=0;$('pause').textContent='Ⅱ Pause';$('automatic').checked=true;$('inflow').value='.28';$('gate').value='0';showInflow();$('normal').classList.add('selected');$('flood').classList.remove('selected');};
$('render-mode').onchange=()=>{renderMode=$('render-mode').value;};
$('quality').onchange=()=>{fluid=new Fluid($('quality').value);$('reset').click();};
$('perspective').onclick=()=>resetCamera();$('side').onclick=()=>resetCamera(true);
document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;});
function frame(now){
  const rawElapsed=(now-last)/1000,elapsed=Math.min(rawElapsed,.10);last=now;
  if(!paused&&!document.hidden){
    accumulator+=elapsed;const start=performance.now();let steps=0;
    while(accumulator>=1/60&&steps<2){fluid.step(1/60);accumulator-=1/60;steps++;}
    // Under load, slow the simulation rather than take unstable, oversized physics steps.
    if(steps===2)accumulator=Math.min(accumulator,1/60);
    solverTotal+=performance.now()-start;
  }
  upper.rotation.z=fluid.pose.upper;lower.rotation.z=fluid.pose.lower;
  controls.update();water.update(fluid);water.render(scene,renderMode);
  frameCount++;frameTotal+=rawElapsed;
  if(!ready){$('loading').hidden=true;ready=true;}
  if(now-lastHud>500){
    lastStatistics=fluid.stats();
    $('head').textContent=fluid.upstreamHead.toFixed(2);$('angle').textContent=(fluid.angle*180/Math.PI).toFixed(0);$('count').textContent=fluid.count.toLocaleString();
    $('status').textContent=paused?'SIMULATION PAUSED':fluid.time<fluid.floodUntil?'FLOOD WATER ARRIVING':fluid.angle>.07?'WATER PASSING UNDER THE GATES':'WATER SPILLING THROUGH THE NOTCH';
    $('gate-value').textContent=fluid.automatic?'Automatic':`${Math.round(fluid.manualAngle*180/Math.PI)}°`;
    $('automatic').checked=fluid.automatic;
    $('performance').textContent=`${Math.round(frameCount/frameTotal)} fps · ${(solverTotal/frameCount).toFixed(0)} ms fluid / frame`;
    if(fluid.automatic)$('gate').value=String(Math.round(fluid.angle*180/Math.PI));
    frameCount=0;frameTotal=0;solverTotal=0;lastHud=now;
  }
  requestAnimationFrame(frame);
}
window.fluidDemo={get ready(){return ready;},get fluid(){return fluid;},get stats(){return {...fluid.stats(),renderer:renderer.info.render,paused,renderMode};},
  advance(seconds){const was=paused;paused=true;for(let i=0;i<Math.round(seconds*60);i++)fluid.step(1/60);paused=was;},
  pause(value=true){paused=value;$('pause').textContent=paused?'▶ Resume':'Ⅱ Pause';},camera,controls};
requestAnimationFrame(frame);
