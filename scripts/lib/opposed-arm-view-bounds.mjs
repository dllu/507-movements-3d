import * as THREE from 'three';

const trigRange=(a,b,lo,hi)=>{
 const f=t=>a*Math.cos(t)+b*Math.sin(t),values=[f(lo),f(hi)],phase=Math.atan2(b,a);
 for(let k=Math.ceil((lo-phase)/Math.PI);phase+k*Math.PI<=hi;k++)values.push(f(phase+k*Math.PI));
 return[Math.min(...values),Math.max(...values)];
};

// Enclose the entire slider stroke and every wheel/pawl angle. These bounds
// use the actual mesh buffers and exact linkage extrema, without pose sampling.
export function opposedArmViewBounds(model,{stroke=model.root.userData.geometry.stroke}={}){
 const u=model.root.userData,p=u.geometry,ends=[u.input(p.sourceSlider[0]-stroke),u.input(p.sourceSlider[0]+stroke)],
  minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity],parts=[];
 const addBounds=(name,low,high)=>{
  for(let i=0;i<3;i++){minimum[i]=Math.min(minimum[i],low[i]-1e-10);maximum[i]=Math.max(maximum[i],high[i]+1e-10);}parts.push({name,min:low,max:high});
 };
 for(const [name,mesh]of Object.entries(u.parts)){
  mesh.updateMatrix();const position=mesh.geometry.attributes.position,vertices=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrix).toArray()),
   family=u.families[name],z=[Math.min(...vertices.map(v=>v[2])),Math.max(...vertices.map(v=>v[2]))];
  if(family==='wheel'){
   const radius=Math.max(...vertices.map(v=>Math.hypot(v[0],v[1])));addBounds(name,[-radius,-radius,z[0]],[radius,radius,z[1]]);continue;
  }
  if(family==='slider'){
   addBounds(name,[Math.min(...vertices.map(v=>v[0]))+p.sourceSlider[0]-stroke,Math.min(...vertices.map(v=>v[1]))+p.sourceSlider[1],z[0]],
    [Math.max(...vertices.map(v=>v[0]))+p.sourceSlider[0]+stroke,Math.max(...vertices.map(v=>v[1]))+p.sourceSlider[1],z[1]]);continue;
  }
  const key=family.startsWith('upper')?'upper':'lower',a=p.arms[key],q=ends.map(k=>k.arms[key].q).sort((a,b)=>a-b);
  if(!(a.rodLength>a.jointRadius&&p.sourceSlider[0]-stroke>a.jointRadius))throw Error('Unsupported linkage extrema');
  if(family===key+'Arm'){
   const x=vertices.map(v=>trigRange(v[0],-v[1],...q)),y=vertices.map(v=>trigRange(v[1],v[0],...q));
   addBounds(name,[Math.min(...x.map(v=>v[0])),Math.min(...y.map(v=>v[0])),z[0]],[Math.max(...x.map(v=>v[1])),Math.max(...y.map(v=>v[1])),z[1]]);
  }else if(family===key+'Rod'){
   const radius=Math.max(...vertices.map(v=>Math.hypot(v[0]-Math.max(0,Math.min(a.rodLength,v[0])),v[1]))),
    x=trigRange(a.rodJoint[0],-a.rodJoint[1],...q),y=trigRange(a.rodJoint[1],a.rodJoint[0],...q);
   addBounds(name,[Math.min(x[0],p.sourceSlider[0]-stroke)-radius,Math.min(y[0],p.sourceSlider[1])-radius,z[0]],
    [Math.max(x[1],p.sourceSlider[0]+stroke)+radius,Math.max(y[1],p.sourceSlider[1])+radius,z[1]]);
  }else if(family===key){
   const radius=Math.max(...vertices.map(v=>Math.hypot(...v))),x=trigRange(a.pivot[0],-a.pivot[1],...q),y=trigRange(a.pivot[1],a.pivot[0],...q);
   addBounds(name,[x[0]-radius,y[0]-radius,p.pivotZ-radius],[x[1]+radius,y[1]+radius,p.pivotZ+radius]);
  }else throw Error('Unknown moving family '+family);
 }
 return{min:minimum,max:maximum,parts,qualification:'Exact trigonometric extrema enclose rigid arms; actual vertex radii enclose wheel rotations and all pawl tilts. Rod vertices lie in convex capsules between the exact joint and slider, and slider translation is bounded over the full input stroke.'};
}
