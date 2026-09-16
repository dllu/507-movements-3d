// Bounded rejected-law diagnostic; this does not generate playback motion.
import profile from '../src/simulation/baked/radial-pin-mangle-pinion.js';
import{createAuthoredGearMovement as create}from'../src/simulation/authored-gears.js';
const m=create({id:194}),d=m.root.userData,g=d.geometry,b=d.blocks,{points}=profile;
const surface=points.flatMap((p,i)=>{const q=points[(i+1)%points.length];return[p,[(p[0]+q[0])/2,(p[1]+q[1])/2]];});
function capsules(s){const ca=Math.cos(-s.pinionAngle),sa=Math.sin(-s.pinionAngle),out=[];for(const pin of b.pinRoots){const a=pin.rotation.z+Math.PI/2+s.wheelAngle,xw=g.toothPitchRadius*Math.cos(a)-s.pinionCenter.x,yw=g.toothPitchRadius*Math.sin(a)-s.pinionCenter.y,x=xw*ca-yw*sa,y=xw*sa+yw*ca;if(Math.hypot(x,y)>.60)continue;out.push({x,y,ux:Math.cos(a-s.pinionAngle),uy:Math.sin(a-s.pinionAngle),pin:pin.userData.index});}return out;}
function gapAt(pins,delta){const c=Math.cos(delta),s=Math.sin(delta);let minimum=Infinity,active;for(const pin of pins)for(const p of surface){const px=p[0]*c-p[1]*s,py=p[0]*s+p[1]*c,dx=px-pin.x,dy=py-pin.y,t=Math.max(-.065,Math.min(.065,dx*pin.ux+dy*pin.uy)),ex=dx-t*pin.ux,ey=dy-t*pin.uy,dist=Math.hypot(ex,ey),gap=dist-.052;if(gap<minimum){minimum=gap;active={pin:pin.pin,moment:(px*ey-py*ex)/dist};}}return{gap:minimum,...active};}
let rows=[],maxDelta=0,minMoment=0,minTravel=Infinity,maxChange=0;
const count=256;
const startPhase=219/1024,endPhase=220/1024;
for(let i=0;i<=count;i++){
 const travel=g.totalPinionTravel*(startPhase+(endPhase-startPhase)*i/count),s=d.stateAtInputTravel(travel),pins=capsules(s);let lo=0,hi=.002,result;
 for(;hi<.32;hi+=.002){result=gapAt(pins,hi);if(result.gap<=.00005)break;lo=hi;}
 if(hi>=.32)throw Error('no pickup contact');
 for(let j=0;j<16;j++){const mid=(lo+hi)/2,r=gapAt(pins,mid);if(r.gap>.00005)lo=mid;else hi=mid;}
 const delta=(lo+hi)/2;result=gapAt(pins,delta);const q=travel+delta;
 if(rows.length){minTravel=Math.min(minTravel,q-rows.at(-1).corrected);maxChange=Math.max(maxChange,Math.abs(delta-rows.at(-1).delta));}
 rows.push({travel,corrected:q,delta,...result,branch:s.branch});maxDelta=Math.max(maxDelta,delta);minMoment=Math.min(minMoment,result.moment);
}
const index=rows.slice(1).reduce((best,row,i)=>Math.abs(row.delta-rows[i].delta)>Math.abs(rows[best+1].delta-rows[best].delta)?i:best,0);
console.log({before:rows[index],after:rows[index+1]});
console.log({maxDelta,minMoment,minTravel,maxChange,nominalStep:g.totalPinionTravel*(endPhase-startPhase)/count,intervalDeltaChange:rows.at(-1).delta-rows[0].delta});
