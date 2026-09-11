import {Vector3,OrthographicCamera} from 'three';
import {MovementEngine} from '../../src/simulation/engine.js';
import catalog from '../../src/data/movements.json';
import {makeOpposedArmCandidate} from './opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './opposed-arm-forces-study.mjs';
export async function mountOpposedArmPreview(file){
 const response=await fetch(file);if(!response.ok)throw Error('Preview data could not be loaded');const data=await response.json(),samples=data.samples,
  container=document.querySelector('#stage'),e=new MovementEngine(container,catalog.movements[78],{playing:false}),source=document.querySelector('#source');
 cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
 e.model.root.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});
 e.model=makeOpposedArmCandidate(data.geometry);e.scene.add(e.model.root);e.updateGroundClearance();
 const u=e.model.root.userData,p=u.geometry,f=makeOpposedArmForceStudy(e.model,data.physics),rate=data.physics.period/data.displayPeriod,
  controls={play:document.querySelector('#play'),restart:document.querySelector('#restart'),view:document.querySelector('#view'),time:document.querySelector('#time'),clock:document.querySelector('#clock')};
 for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
  Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
  light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
 }
 let time=samples[0][0],view='front',playing=false,previous=performance.now(),frames=0,started=null,completed=null;
 controls.time.min=samples[0][0];controls.time.max=samples.at(-1)[0];
 const at=t=>{
  let lo=0,hi=samples.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(samples[mid][0]<t)lo=mid+1;else hi=mid;}
  if(!lo)return samples[0].slice(1);const a=samples[lo-1],b=samples[lo],s=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));return a.slice(1).map((v,i)=>v+(b[i+1]-v)*s);
 };
 const renderAt=t=>{
  time=Math.max(samples[0][0],Math.min(samples.at(-1)[0],t));const x=at(time),k=f.input(time);
  u.setState({sliderX:k.sliderX,theta:x[0],upperBeta:x[1],lowerBeta:x[2]});
  const size=container.getBoundingClientRect(),aspect=size.width/size.height,cx=(715-p.center[0])/p.scale,cy=(p.center[1]-690)/p.scale;
  if(view==='front'){
   const width=1430/p.scale*1.10,height=width/aspect,camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
   camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
  }else{
   const direction=view==='rear'?new Vector3(4,3,-10):new Vector3(-4,3,10);e.fitCamera(direction);
   if(view==='upper'||view==='lower'){
    const point=k.arms[view].pivot,focus=new Vector3(...point,.12);e.camera.position.copy(focus).add(new Vector3(1,2,5).multiplyScalar(.8));e.camera.lookAt(focus);e.camera.near=.005;e.camera.updateProjectionMatrix();e.camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,e.camera);
  }
  controls.time.value=time;controls.clock.textContent=(time/rate).toFixed(2)+' s displayed';frames++;return u.kinematics;
 };
 const pause=()=>{playing=false;controls.play.textContent='Play';};
 const play=()=>{if(time>=samples.at(-1)[0])time=samples[0][0];playing=true;previous=performance.now();started={wall:previous,time,frames};completed=null;controls.play.textContent='Pause';};
 const tick=now=>{
  if(playing){const next=time+(now-previous)/1000*rate;renderAt(next);if(next>=samples.at(-1)[0]){completed={wall:now,time,frames};pause();}}
  previous=now;requestAnimationFrame(tick);
 };
 controls.play.onclick=()=>playing?pause():play();controls.restart.onclick=()=>{pause();renderAt(samples[0][0]);};
 controls.time.oninput=()=>{pause();renderAt(Number(controls.time.value));};controls.view.onchange=()=>{view=controls.view.value;renderAt(time);};
 await source.decode();renderAt(time);requestAnimationFrame(tick);
 window.opposedPreview={engine:e,data,renderAt,pause,play,setView:name=>{view=name;controls.view.value=name;return renderAt(time);},
  metrics:()=>({time,view,playing,frames,started,completed,rate})};
}
