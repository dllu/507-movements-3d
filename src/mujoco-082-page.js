import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import {makeMujocoTreadle} from './simulation/mujoco-treadle/visual.js';
import './mujoco-082.css';

const stage=document.querySelector('#stage'),status=document.querySelector('#status'),play=document.querySelector('#play');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.append(renderer.domElement);
renderer.setClearColor(0xf3f0e9);renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x736d61,2.4));
const light=new THREE.DirectionalLight(0xffffff,2.8);light.position.set(-3,6,8);scene.add(light);
const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(4,1,-6);scene.add(fill);
const camera=new THREE.OrthographicCamera(-3,3,3,-3,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
let model,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last,raf;
const center=new THREE.Vector3(1.16,-.715,.05),direction=new THREE.Vector3(0,0,10);
function fit(view=direction){direction.copy(view);camera.position.copy(center).add(direction);controls.target.copy(center);controls.update();resize();}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);const half=Math.max(2.25,2.6*h/w);camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.render(scene,camera);}
new ResizeObserver(resize).observe(stage);
function animate(now){const dt=last===undefined?0:Math.min(.1,(now-last)/1000);last=now;
 if(playing&&model)model.advance(dt*Number(document.querySelector('#speed').value));controls.update();renderer.render(scene,camera);
 if(model)document.querySelector('#clock').textContent=model.physics.data.time.toFixed(2)+' s';raf=requestAnimationFrame(animate);
}
function setPlaying(value){playing=value;play.textContent=value?'Pause':'Play';}
play.addEventListener('click',()=>setPlaying(!playing));document.querySelector('#reset').addEventListener('click',()=>model.reset());
document.querySelector('#front').addEventListener('click',()=>fit(new THREE.Vector3(0,0,10)));
document.querySelector('#oblique').addEventListener('click',()=>fit(new THREE.Vector3(-3,2,9)));
fit();raf=requestAnimationFrame(animate);
async function initialize(){
try{
 const mujoco=await loadMujoco({locateFile:file=>file.endsWith('.wasm')?wasmUrl:file});model=makeMujocoTreadle(mujoco);scene.add(model.root);
 play.disabled=false;document.querySelector('#reset').disabled=false;setPlaying(playing);status.textContent='Drag to orbit · Scroll or pinch to zoom';
 window.mujoco082={model,renderer,scene,camera,controls,setPlaying,fit,THREE};
}catch(error){status.textContent='Unable to initialize the physics preview.';console.error(error);}
}
initialize();
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);model?.dispose();controls.dispose();renderer.dispose();});
