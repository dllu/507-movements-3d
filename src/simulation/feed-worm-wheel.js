import {makeInstancedWormWheel} from './instanced-worm-wheel.js';
import {feedWormWheelParameters,feedWormWheelCut} from '../data/feed-worm-wheel-profile.js';

// The hob generator places its worm above the wheel. Rotate that pair about
// X to put the worm below, then mirror X for the opposite-hand pair. Rotor
// phase -pi/2 and the centered three-turn worm's -pi/2 phase are one mesh pose.
export function makeFeedWormWheel(handedness,boreRadius,material){
 const mesh=makeInstancedWormWheel(feedWormWheelParameters,feedWormWheelCut,boreRadius,material);
 if(handedness===1)mesh.geometry.rotateX(Math.PI);
 else {
  mesh.geometry.scale(1,1,-1);
  const index=mesh.geometry.index;
  for(let i=0;i<index.count;i+=3){const a=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,a);}
 }
 mesh.userData={...mesh.userData,handedness,profile:'offline-worm-generated-envelope',clearance:feedWormWheelCut.clearance};
 return mesh;
}
