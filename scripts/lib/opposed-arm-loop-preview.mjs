import {Vector3} from 'three';
import {MovementEngine} from '../../src/simulation/engine.js';
import catalog from '../../src/data/movements.json';
import {makeOpposedArmCandidate} from './opposed-arm-candidate.mjs';
import {sampleOpposedArmPlayback} from './opposed-arm-playback.mjs';
import {opposedArmViewBounds} from './opposed-arm-view-bounds.mjs';

export async function mountOpposedArmLoopPreview(file){
 const response=await fetch(file);if(!response.ok)throw Error('Playback data could not be loaded');const profile=await response.json(),
  container=document.querySelector('#stage'),e=new MovementEngine(container,catalog.movements[78],{playing:false});
 cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
 e.model.root.traverse(object=>{object.geometry?.dispose();for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])material.dispose();});
 e.model=makeOpposedArmCandidate(profile.geometry);e.scene.add(e.model.root);e.updateGroundClearance();
 const u=e.model.root.userData,bounds=opposedArmViewBounds(e.model,{stroke:profile.physics.stroke}),controls=Object.fromEntries(['play','restart','period','view','time','clock'].map(id=>[id,document.querySelector('#'+id)]));
 u.sampledMotionBounds={min:bounds.min,max:bounds.max};
 for(const light of e.scene.children.filter(l=>l.isDirectionalLight&&l.castShadow)){
  Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
  light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
 }
 let time=0,period=profile.playbackPeriod,view='front',playing=false,previous=performance.now(),state,frames=[];
 const render=()=>{state=sampleOpposedArmPlayback(profile,time,{period});u.setState(state);e.renderer.render(e.scene,e.camera);
  controls.time.max=Math.max(4*period,Math.ceil(time/period)*period);controls.time.value=time;controls.clock.textContent=time.toFixed(2)+' s · cycle '+(state.cycle+1);return state;};
 const setView=name=>{view=name;controls.view.value=name;e.fitCamera(name==='front'?new Vector3(0,0,10):name==='rear'?new Vector3(4,3,-10):new Vector3(-4,3,10));return render();},
  setPlaying=value=>{playing=value;previous=performance.now();controls.play.textContent=playing?'Pause':'Play';},
  setTime=value=>{if(!Number.isFinite(value))throw Error('Invalid time');time=Math.max(0,value);return render();},
  setPeriod=value=>{if(!Number.isFinite(value)||value<=0)throw Error('Invalid period');time*=value/period;period=value;controls.period.value=String(value);return render();};
 const tick=now=>{if(playing){const dt=(now-previous)/1000;time+=dt;frames.push({wall:now,time,dt});if(frames.length>1000)frames.shift();render();}else if(e.controls.update())render();previous=now;requestAnimationFrame(tick);};
 controls.play.onclick=()=>setPlaying(!playing);controls.restart.onclick=()=>{setPlaying(false);setTime(0);};controls.view.onchange=()=>setView(controls.view.value);
 controls.period.onchange=()=>setPeriod(Number(controls.period.value));controls.time.oninput=()=>{setPlaying(false);setTime(Number(controls.time.value));};
 e.controls.addEventListener('change',()=>{if(!playing)render();});
 const observer=new ResizeObserver(()=>{e.resize();setView(view);});observer.observe(container);
 await document.querySelector('#source').decode();setView('front');requestAnimationFrame(tick);
 window.opposedLoopPreview={e,profile,bounds,setView,setPlaying,setTime,setPeriod,render,get state(){return state;},get frames(){return frames;},get period(){return period;},get playing(){return playing;}};
}
