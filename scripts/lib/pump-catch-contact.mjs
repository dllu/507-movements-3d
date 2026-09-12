import {renderedPrism} from './crossed-rack-mesh-prisms.mjs';

const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
export const rotate2=(p,a)=>[Math.cos(a)*p[0]-Math.sin(a)*p[1],Math.sin(a)*p[0]+Math.cos(a)*p[1]];
function surface(geometry){
  const prism=renderedPrism(geometry),edges=prism.boundary;
  const build=items=>{
    const low=[0,1].map(k=>Math.min(...items.map(e=>e.min[k]))),high=[0,1].map(k=>Math.max(...items.map(e=>e.max[k])));
    if(items.length<=8)return{low,high,items};const axis=high[0]-low[0]>high[1]-low[1]?0:1;
    items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);const mid=items.length>>1;
    return{low,high,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  const tree=build(edges.map((e,index)=>({...e,index}))),boxDistance=(p,b)=>Math.max(0,b.low[0]-p[0],p[0]-b.high[0])**2+Math.max(0,b.low[1]-p[1],p[1]-b.high[1])**2;
  const closest=p=>{
    let square=Infinity,edge=null,at=null,fraction=null;
    const visit=node=>{
      if(boxDistance(p,node)>square)return;
      if(node.items)for(const e of node.items){const t=Math.max(0,Math.min(1,dot(sub(p,e.a),e.d)/e.square)),q=add(e.a,e.d.map(v=>v*t)),s=dot(sub(p,q),sub(p,q));
        if(s<square){square=s;edge=e;at=q;fraction=t;}}
      else{const a=boxDistance(p,node.left),b=boxDistance(p,node.right);visit(a<=b?node.left:node.right);visit(a<=b?node.right:node.left);}
    };visit(tree);let inside=false;
    const ray=node=>{
      if(p[1]<node.low[1]||p[1]>=node.high[1]||p[0]>=node.high[0])return;
      if(node.items)for(const e of node.items)if((e.a[1]>p[1])!==(e.b[1]>p[1])&&p[0]<(e.b[0]-e.a[0])*(p[1]-e.a[1])/(e.b[1]-e.a[1])+e.a[0])inside=!inside;
      else{};
      if(!node.items){ray(node.left);ray(node.right);}
    };ray(tree);
    const distance=Math.sqrt(square),normal=distance>1e-12?sub(p,at).map(v=>v/(inside?-distance:distance)):edge.normal;
    return{gap:inside?-distance:distance,point:at,normal,edge:edge.index,fraction};
  };
  return{...prism,closest};
}

export function makePumpCatchContact(model){
  const u=model.root.userData,pivot=u.geometry.pivot,cam=surface(u.parts.pointedCamC.geometry),hook=surface(u.parts.hookedCatchB.geometry),
    shaft=surface(u.parts.inputShaft.geometry),stop=surface(u.parts.fixedTripStop.geometry);
  const query=(q,camAngle,{margin=.01}={})=>{
    const [wheel,angle]=q,P=rotate2(pivot,wheel),contacts=[];
    const hookWorld=p=>add(P,rotate2(p,angle)),hookLocal=p=>rotate2(sub(p,P),-angle);
    const append=(kind,point,normal,gap,feature)=>{
      const gradient=[cross2(P,normal),cross2(sub(point,P),normal)],inputGradient=kind==='cam'||kind==='shaft'?-cross2(point,normal):0;
      contacts.push({kind,point,normal,gap,gradient,inputGradient,feature});
    };
    for(const[kind,obstacle,rotation]of [['cam',cam,camAngle],['shaft',shaft,camAngle],['stop',stop,0]]){
      for(let i=0;i<hook.points.length;i++){
        const point=hookWorld(hook.points[i]),local=rotate2(point,-rotation),f=obstacle.closest(local);if(f.gap>margin)continue;
        append(kind,point,rotate2(f.normal,rotation),f.gap,{pointOn:'hook',vertex:i,edge:f.edge,fraction:f.fraction,otherPoint:rotate2(f.point,rotation)});
      }
      for(let i=0;i<obstacle.points.length;i++){
        const point=rotate2(obstacle.points[i],rotation),f=hook.closest(hookLocal(point));if(f.gap>margin)continue;
        const normal=rotate2(f.normal,angle).map(v=>-v),hookPoint=hookWorld(f.point);
        append(kind,hookPoint,normal,f.gap,{pointOn:kind,vertex:i,edge:f.edge,fraction:f.fraction,otherPoint:point});
      }
    }
    // The taut pump rope's lower stroke limit is an assumed rigid stop.
    contacts.push({kind:'pump-stop',gap:-wheel,gradient:[-1,0],inputGradient:0});
    return contacts;
  };
  return{cam,hook,shaft,stop,query};
}
