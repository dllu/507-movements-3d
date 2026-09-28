import * as THREE from 'three';
import measured from '../data/crossed-rack-source.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {sub,rotate,poly,circle,capsule,plate,disk,turned,polygonClipping as clip,familyMass} from './finite-plate-geometry.js';

const source=point=>[(point[0]-measured.center[0])/measured.scale,(measured.center[1]-point[1])/measured.scale];
const outline=commands=>{
 const shape=new THREE.Shape();
 for(const [operation,...values]of commands){
  if(operation==='M')shape.moveTo(...values);else if(operation==='L')shape.lineTo(...values);
  else if(operation==='Q')shape.quadraticCurveTo(...values);else throw Error(operation);
 }
 return shape.getPoints(12).map(p=>p.toArray());
};
// These visible contours are traced in the Brown crop. Covered contours and
// the hook webs returning toward the rack plane remain study assumptions.
const pawlContours={
 left:[['M',443,255],['Q',461,250,478,270],['Q',490,284,486,304],['L',731,613],
  ['Q',751,637,753,657],['Q',758,680,742,690],['Q',737,695,725,685],
  ['L',704,678],['Q',692,670,690,656],['L',710,674],['Q',724,681,733,668],
  ['Q',740,657,727,637],['L',471,320],['Q',447,329,429,313],['Q',411,299,420,276],['Q',425,260,443,255]],
 right:[['M',787,271],['Q',808,258,830,275],['Q',846,290,838,309],['Q',825,330,791,324],
  ['L',521,636],['Q',504,654,506,666],['Q',511,680,527,679],['L',542,672],
  ['Q',537,687,519,688],['Q',501,697,491,681],['Q',481,667,490,643],
  ['L',774,307],['Q',771,291,779,279],['Q',783,274,787,271]]
};

export function makeCrossedRackGeometry({hookRelief={left:704,right:524}}={}){
 const root=new THREE.Group(),parts={},families={},blocks={},profiles={},
  p={center:measured.center,scale:measured.scale,teeth:measured.teeth,pitch:measured.pitch/measured.scale,hookRelief,
   source:measured,initialAngles:{left:0,right:0},anchors:{},layers:{rack:[-.06,.06],lever:[-.22,-.14],left:[.07,.11],right:[.12,.16]}};
 for(const family of ['fixed','rack','lever','left','right']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 const attach=(name,geometry,family,color,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.18,roughness:.58}));mesh.name=name;mesh.position.fromArray(position);
  parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;
 };
 const rackCommands=[['M',485,144],['L',758,144],['Q',725,169,714,201],['L',714,measured.toothOrigins.right-13]];
 // Walk the right edge down, then the stem and left edge back up.
 for(let i=0;i<measured.teeth;i++){
  const y=measured.toothOrigins.right+i*measured.pitch;
  rackCommands.push(['L',722-.8*i,y],['L',697-.8*i,y]);
 }
 // Brown breaks the stem off below the teeth (a drawing convention); it is
 // modelled whole, running on to a square end below the view.
 rackCommands.push(['L',683,measured.toothOrigins.right+15*measured.pitch+7],['L',683,1480],
  ['L',556,1480],['L',556,measured.toothOrigins.left+15*measured.pitch+10]);
 for(let i=measured.teeth-1;i>=0;i--){
  const y=measured.toothOrigins.left+i*measured.pitch;
  rackCommands.push(['L',546-.1*i,y],['L',518-.15*i,y]);
 }
 rackCommands.push(['L',525,measured.toothOrigins.left-14],['L',525,200],['Q',516,169,501,150],['L',485,144]);
 const rackOuter=outline(rackCommands).map(source),slot=measured.slot,
  slotRadius=(slot.right-slot.left)/(2*measured.scale),slotX=(slot.left+slot.right)/2,
  slotShape=capsule(source([slotX,slot.top+(slot.right-slot.left)/2]),source([slotX,slot.bottom-(slot.right-slot.left)/2]),slotRadius,128),
  rackShape=clip.difference(poly(rackOuter),slotShape);
 attach('slottedRack',plate(rackShape,...p.layers.rack),'rack',PALETTE.driven);profiles.rack=rackShape;
 const leverCommands=[['M',219,274],['L',276,271],['L',412,251],['L',519,237],['Q',620,229,724,246],
  ['L',805,249],['L',921,266],['L',997,278],['L',1052,281],['L',1052,316],['L',990,317],
  ['L',803,339],['L',723,345],['Q',617,359,498,348],['L',277,316],['L',219,308],['L',219,274]],
  fulcrumRadius=measured.circles.fulcrum.radius/measured.scale,leverShape=clip.difference(poly(outline(leverCommands).map(source)),poly(circle([0,0],fulcrumRadius+.009,128)));
 attach('taperedLever',plate(leverShape,...p.layers.lever),'lever',PALETTE.driver);
 for(const key of ['left','right']){
  const c=measured.circles[key+'Weight'],center=source(c.center),radius=c.radius/measured.scale,
   weight=turned(Array.from({length:65},(_,i)=>[-radius*Math.cos(Math.PI*i/64),i===0||i===64?0:radius*Math.sin(Math.PI*i/64)]),128),
   positions=weight.attributes.position,normals=weight.attributes.normal;
  for(let i=0;i<positions.count;i++){const n=new THREE.Vector3().fromBufferAttribute(positions,i).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
  attach(key+'EndWeight',weight,'lever',PALETTE.driver,[...center,-.18]);
 }
 attach('fixedFulcrum',disk(fulcrumRadius,-.28,.082,128),'fixed',PALETTE.muted);
 attach('fulcrumRearCap',disk(fulcrumRadius+.025,-.298,-.28,128),'fixed',PALETTE.muted);
 for(const key of ['left','right']){
  const c=measured.circles[key+'PawlBore'],P=source(c.center),local=v=>sub(source(v),P),shape=poly(outline(pawlContours[key]).map(local)),
   boreRadius=c.radius/measured.scale,pinRadius=boreRadius-2/measured.scale,[low,high]=p.layers[key],
   front=clip.difference(shape,poly(circle([0,0],boreRadius,128)));
  p.anchors[key]=P;p[key+'BoreRadius']=boreRadius;p[key+'PinRadius']=pinRadius;
  attach(key+'Pawl',plate(front,low,high),key,PALETTE.brass);
  const y=key==='left'?646:648,
   hookRegion=poly([[400,y],[850,y],[850,720],[400,720]].map(local));
  let hook=clip.intersection(shape,hookRegion);
  // The visible toe continues in front of the rack. Relieve its concealed
  // back so the driving web fits beneath a tooth instead of filling the
  // engraving's overlapping projected outlines with intersecting metal.
  if(hookRelief){
   const cut=hookRelief[key],region=key==='left'?[[cut,620],[800,620],[800,720],[cut,720]]:
    [[480,620],[cut,620],[cut,720],[480,720]];
   hook=clip.intersection(hook,poly(region.map(local)));
  }
  attach(key+'HookWeb',plate(hook,-.025,low),key,PALETTE.brass);profiles[key]=hook;
  // The pin stops just inside the eye's bore: nothing stands in front of
  // the flat pawl plate.
  attach(key+'PawlPin',disk(pinRadius,-.235,high-.004,128),'lever',PALETTE.muted,[...P,0]);
  attach(key+'PinRearCap',disk(boreRadius+.010,-.247,-.235,128),'lever',PALETTE.muted,[...P,0]);
 }
 const anchorAt=(key,q)=>rotate(p.anchors[key],q),
  setState=({q=0,rackY=0,leftAngle=0,rightAngle=0}={})=>{
   blocks.lever.rotation.z=q;blocks.rack.position.y=rackY;
   for(const key of ['left','right']){const P=anchorAt(key,q);blocks[key].position.set(...P,0);blocks[key].rotation.z=key==='left'?leftAngle:rightAngle;}
   root.userData.kinematics={q,rackY,leftAngle,rightAngle,anchors:Object.fromEntries(['left','right'].map(k=>[k,anchorAt(k,q)]))};
   root.updateMatrixWorld(true);return root.userData.kinematics;
  };
 const masses=Object.fromEntries(['rack','left','right'].map(k=>[k,familyMass(parts,families,k)]));
 root.userData={parts,families,blocks,geometry:p,profiles,source,anchorAt,setState,masses,
  hideGround:true,cameraFov:8,shadowCameraHalfExtent:5.5,shadowBias:-.00003,shadowNormalBias:.004,
  mechanism:'crossed-hook-slotted-rack-drive',fidelity:'authored',
  qualification:'Source-measured finite 16-tooth rack, tapered lever and crossed hooked pawls. Axial layers, flush pivot pins without front caps and concealed relief behind the visible hook toes are reconstruction assumptions. Source pose is prescribed for geometry review; contact, free motion and finite travel are unverified.'};
 setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
