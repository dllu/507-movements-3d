import {makePumpCatchNormalContact} from './pump-catch-normal-contact.mjs';
import {renderedPrism} from './crossed-rack-mesh-prisms.mjs';
import {rotate2,cross2} from './pump-catch-contact.mjs';

const sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),neg=a=>a.map(v=>-v);
function boundary(geometry){
  const prism=renderedPrism(geometry),normals=new Map();
  for(const e of prism.boundary)for(const p of [e.a,e.b]){const n=normals.get(p.join(','))??[];n.push(e.normal);normals.set(p.join(','),n);}
  const atVertex=i=>normals.get(prism.points[i].join(','));
  const closest=p=>{
    let square=Infinity,edge,point,fraction,inside=false;
    for(const e of prism.boundary){
      const delta=sub(p,e.a),f=Math.max(0,Math.min(1,dot(delta,e.d)/e.square)),q=add(e.a,e.d.map(v=>v*f)),d=sub(p,q),s=dot(d,d);
      if(s<square){square=s;edge=e;point=q;fraction=f;}
      if((e.a[1]>p[1])!==(e.b[1]>p[1])&&p[0]<(e.b[0]-e.a[0])*(p[1]-e.a[1])/(e.b[1]-e.a[1])+e.a[0])inside=!inside;
    }
    const distance=Math.sqrt(square),normal=distance>1e-12?sub(p,point).map(v=>v/(inside?-distance:distance)):edge.normal,
      cone=fraction*edge.length<1e-12?normals.get(edge.a.join(',')):(1-fraction)*edge.length<1e-12?normals.get(edge.b.join(',')):[edge.normal];
    return{gap:inside?-distance:distance,point,normal,cone};
  };
  return{...prism,atVertex,closest};
}
function inCone(n,faces){
  for(const a of faces)if(Math.hypot(...sub(n,a.map(v=>v*Math.max(0,dot(n,a)))))<1e-9)return true;
  for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
    const a=faces[i],b=faces[j],d=cross2(a,b);if(Math.abs(d)>1e-12&&cross2(n,b)/d>=-1e-10&&cross2(a,n)/d>=-1e-10)return true;
  }return false;
}

export function makePumpCatchHeelContact(model){
  const base=makePumpCatchNormalContact(model),u=model.root.userData;if(!u.heelStop)return base;
  const lug=boundary(u.parts.catchHeelLug.geometry),stop=boundary(u.parts.wheelHeelStop.geometry),pivot=u.geometry.pivot,
    pointZ=(Math.max(lug.low,stop.low)+Math.min(lug.high,stop.high))/2;
  const heel=(q,{margin=.01,raw=false}={})=>{
    const P=rotate2(pivot,q[0]),angle=q[1]-q[0],result=[];
    const append=(point,other,normal,gap,catchCone,stopCone)=>{
      if(raw){result.push({gap});return;}
      const distance=Math.hypot(...sub(point,other)),candidates=catchCone.length===1?catchCone:stopCone.length===1?stopCone:distance<1e-9?[...catchCone,...stopCone]:[normal],
        choices=candidates.filter(n=>inCone(n,catchCone)&&inCone(n,stopCone));
      if(!choices.length&&gap<0)choices.push(normal);
      for(const[n,normal]of choices.entries()){
        if(choices.slice(0,n).some(a=>dot(a,normal)>1-1e-12))continue;
        const arm=cross2(point,normal),worldNormal=rotate2(normal,q[0]);
        result.push({kind:'heel',point:add(P,rotate2(point,q[0])),pointZ,normal:worldNormal,gap:dot(sub(point,other),normal),
          gradient:[-arm,arm],inputGradient:0,catchPart:'catchHeelLug',otherPart:'wheelHeelStop'});
      }
    };
    for(let i=0;i<lug.points.length;i++){
      const point=rotate2(lug.points[i],angle),f=stop.closest(point);if(f.gap>margin)continue;
      append(point,f.point,f.normal,f.gap,lug.atVertex(i).map(n=>neg(rotate2(n,angle))),f.cone);
    }
    for(let i=0;i<stop.points.length;i++){
      const point=stop.points[i],f=lug.closest(rotate2(point,-angle));if(f.gap>margin)continue;
      append(rotate2(f.point,angle),point,neg(rotate2(f.normal,angle)),f.gap,f.cone.map(n=>neg(rotate2(n,angle))),stop.atVertex(i));
    }return result;
  };
  return{...base,heel,lug,heelStop:stop,query:(q,angle,options)=>[...base.query(q,angle,options),...heel(q,options)],
    minimumRawGap:(q,angle)=>Math.min(base.minimumRawGap(q,angle),...heel(q,{raw:true}).map(c=>c.gap)),
    qualification:base.qualification+' The added heel reaction acts between the free catch and wheel at their actual shared mesh point; equal/opposite pin moments do no work on their common rotation.'};
}
