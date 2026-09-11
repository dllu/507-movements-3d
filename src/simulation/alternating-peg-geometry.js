import {add,sub,rotate} from './finite-plate-geometry.js';

export function makeAlternatingPegGeometry({seatPhase=1.0016665532175244}={}){
 const center=[456.9848887445678,837.6559823723948],scale=433.5789672975984,
  source=p=>[(p[0]-center[0])/scale,(center[1]-p[1])/scale],
  A=source([1177.5296875,619.965625]),pivots={upper:source([1180.398316970547,475.1991584852735]),lower:source([1180.7553310886644,771.7384960718294])},
  arms=Object.fromEntries(Object.entries(pivots).map(([k,p])=>[k,sub(p,A)])),pitch=2*Math.PI/24,orbit=379.3842184404373/scale,
  upperPhase=seatPhase,phases={upper:upperPhase,lower:upperPhase-2*pitch},
  seats=Object.fromEntries(Object.entries(phases).map(([k,a])=>[k,rotate([orbit,0],a)])),
  vectors=Object.fromEntries(Object.entries(pivots).map(([k,P])=>[k,sub(seats[k],P)])),
  lengths=Object.fromEntries(Object.entries(vectors).map(([k,v])=>[k,Math.hypot(...v)])),
  initialAngles=Object.fromEntries(Object.entries(vectors).map(([k,v])=>[k,Math.atan2(-v[1],-v[0])])),
  anchorAt=(key,q)=>add(A,rotate(arms[key],q)),pinAt=(index,theta)=>rotate([orbit,0],upperPhase+index*pitch+theta);
 return{parameters:{center,scale,A,pivots,arms,pitch,orbit,phases,seats,vectors,lengths,initialAngles,pinRadius:.049,innerRadius:323.5218298952886/scale},source,anchorAt,pinAt};
}
