import {add,sub,rotate} from '../../src/simulation/finite-plate-geometry.js';
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],mul=(a,s)=>a.map(v=>v*s);

export function finitePolygon(raw){
 const points=[];
 for(const p of raw){const q=p.map(Math.fround);if(!points.length||Math.hypot(...sub(q,points.at(-1)))>1e-12)points.push(q);}
 if(Math.hypot(...sub(points[0],points.at(-1)))<1e-12)points.pop();
 if(points.reduce((s,p,i)=>s+cross(p,points[(i+1)%points.length]),0)<0)points.reverse();
 const edges=points.map((a,i)=>{
  const b=points[(i+1)%points.length],d=sub(b,a),square=dot(d,d),length=Math.sqrt(square);
  if(length<1e-12)throw Error('Degenerate profile edge');
  return{a,b,d,square,length,normal:[d[1]/length,-d[0]/length],index:i,min:a.map((v,k)=>Math.min(v,b[k])),max:a.map((v,k)=>Math.max(v,b[k]))};
 });
 const build=items=>{
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(const e of items)for(let k=0;k<2;k++){min[k]=Math.min(min[k],e.min[k]);max[k]=Math.max(max[k],e.max[k]);}
  if(items.length<=8)return{min,max,items};
  const axis=max[0]-min[0]>max[1]-min[1]?0:1;
  items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);const middle=items.length>>1;
  return{min,max,left:build(items.slice(0,middle)),right:build(items.slice(middle))};
 },tree=build([...edges]),boxDistance=(point,node)=>Math.hypot(...point.map((v,k)=>Math.max(0,node.min[k]-v,v-node.max[k]))),
  center=tree.min.map((v,k)=>(v+tree.max[k])/2),radius=Math.max(...points.map(p=>Math.hypot(...sub(p,center))));
 const closest=point=>{
  let best=Infinity,result=null,inside=false;
  const near=node=>{
   if(boxDistance(point,node)>best)return;
   if(node.items){for(const e of node.items){const fraction=Math.max(0,Math.min(1,dot(sub(point,e.a),e.d)/e.square)),
    at=add(e.a,mul(e.d,fraction)),delta=sub(point,at),distance=Math.hypot(...delta);
    if(distance<best){best=distance;result={point:at,delta,fraction,index:e.index,edge:e};}
   }}else{
    const a=boxDistance(point,node.left),b=boxDistance(point,node.right);if(a<b){near(node.left);near(node.right);}else{near(node.right);near(node.left);}
   }
  };
  const ray=node=>{
   if(node.min[1]>point[1]||node.max[1]<=point[1]||node.max[0]<=point[0])return;
   if(node.items){for(const e of node.items)if((e.a[1]>point[1])!==(e.b[1]>point[1])&&point[0]<e.a[0]+(point[1]-e.a[1])*e.d[0]/e.d[1])inside=!inside;}
   else{ray(node.left);ray(node.right);}
  };
  near(tree);ray(tree);
  return{...result,inside,gap:(inside?-1:1)*best,normal:best>1e-12?mul(result.delta,(inside?-1:1)/best):result.edge.normal};
 };
 return{points,edges,closest,center,radius};
}

export function makePullPawlContact(candidate){
 const u=candidate.root.userData,p=u.geometry,profiles=Object.fromEntries(['wheel','left','right'].map(k=>[k,finitePolygon(u.profiles[k])]));
 const pair=(key,q,theta,alpha,padding=.003)=>{
  const wheel=profiles.wheel,pawl=profiles[key],P=u.anchorAt(key,q),rows=[];
  let minimumGap=Infinity;
  const keep=(id,f,normal,W,H)=>{
   minimumGap=Math.min(minimumGap,f.gap);if(f.gap>padding)return;
   rows.push({id:key+':'+id,key,gap:f.gap,normal,wheelPoint:W,pawlPoint:H,J:[-cross(W,normal),cross(sub(H,P),normal)]});
  };
  for(let i=0;i<pawl.points.length;i++){
   const H=add(P,rotate(pawl.points[i],alpha)),f=wheel.closest(rotate(H,-theta)),W=rotate(f.point,theta),normal=rotate(f.normal,theta);
   keep('H'+i+'W'+f.index,f,normal,W,H);
  }
  const worldCenter=add(P,rotate(pawl.center,alpha));
  for(let i=0;i<wheel.points.length;i++){
   const W=rotate(wheel.points[i],theta),lower=Math.hypot(...sub(W,worldCenter))-pawl.radius;
   if(lower>Math.max(padding,minimumGap))continue;
   const f=pawl.closest(rotate(sub(W,P),-alpha)),H=add(P,rotate(f.point,alpha)),normal=mul(rotate(f.normal,alpha),-1);
   keep('W'+i+'H'+f.index,f,normal,W,H);
  }
  return{rows,minimumGap};
 };
 const seat=(key,{q=0,theta=0,lower=p.initialAngles[key]-.3,upper=p.initialAngles[key]+.3,steps=160}={})=>{
  let previous=lower,last=pair(key,q,theta,lower,0).minimumGap;
  if(last<0)return{okay:false,reason:'opening-bracket-penetrates',gap:last};
  for(let i=1;i<=steps;i++){
   const next=lower+(upper-lower)*i/steps,gap=pair(key,q,theta,next,0).minimumGap;
   if(gap<=0){let lo=previous,hi=next;for(let j=0;j<38;j++){const mid=(lo+hi)/2;if(pair(key,q,theta,mid,0).minimumGap>0)lo=mid;else hi=mid;}
    const alpha=(lo+hi)/2,result=pair(key,q,theta,alpha,1e-7);
    return{okay:true,alpha,...result,sourceError:Math.abs(alpha-p.initialAngles[key])*p.lengths[key]*p.scale};
   }
   previous=next;last=gap;
  }
  return{okay:false,reason:'no-closing-contact',gap:last};
 };
 return{profiles,pair,seat};
}
