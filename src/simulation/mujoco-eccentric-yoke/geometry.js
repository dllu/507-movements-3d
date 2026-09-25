import * as THREE from 'three';
import source from './source.js';
import {cubicPolyline} from '../cubic-polyline.js';
import {plate, poly, circle, capsule, disk, ring, polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from '../primitives.js';
import {wallGuide} from '../wall-guide-hardware.js';

export {THREE};

// Closed interpolating cubic, flattened to <= 0.1 source pixel per chord.
function outline(points) {
  const result = [], n = points.length;
  for (let i = 0; i < n; i++) {
    const [a,b,c,d] = [-1,0,1,2].map(k => points[(i+k+n)%n]);
    const controls = [b, b.map((v,k) => v+(c[k]-a[k])/6), c.map((v,k) => v-(d[k]-b[k])/6), c];
    result.push(...cubicPolyline(controls, .001).points.slice(0,-1));
  }
  return poly(result);
}

export function makeEccentricYokeGeometry() {
  const root = new THREE.Group(), parts = {}, families = {}, blocks = {};
  const attach = (name, geometry, family, color, position = [0,0,0]) => {
    if (!blocks[family]) {blocks[family] = new THREE.Group(); root.add(blocks[family]);}
    const mesh = new THREE.Mesh(geometry, matte(color, {metalness:.14, roughness:.6}));
    mesh.name = name; mesh.position.fromArray(position); blocks[family].add(mesh);
    parts[name] = mesh; families[name] = family; return mesh;
  };
  const scale = source.scale, [sx,sy] = source.shaftCenter, [cx,cy] = source.sheaveCenter;
  const offset = [(cx-sx)/scale,(sy-cy)/scale], eccentricity = Math.hypot(...offset);
  const radius = source.sheaveRadius/scale, shaftRadius = source.shaftRadius/scale;
  const depth = .24, clearance = .001, baseTop = -2.15;
  const yokePoint = ([x,y]) => [(x-cx)/scale,(sy-y)/scale];
  const rodRoots = source.rodRoots.map(x => (x-cx)/scale), rodTips = source.rodTips.map(x => (x-cx)/scale);
  const tracedHole = outline(source.inner.map(yokePoint));
  // Brown draws both yoke outlines as smooth ovals. Each is an ellipse split
  // at its waist by a straight run: the inner run is the machined working
  // face, parallel through the eccentric center's vertical sweep with a
  // small end margin, and its elliptic ends contain the swept circle. The
  // hand-traced ink (kept as profiles.tracedHole) is lumpy and bowed.
  const workingHalfHeight = eccentricity+.01, workingRadius = radius+clearance;
  const extent = (points,k) => points.map(yokePoint).map(p=>p[k]);
  const oval = (halfWidth,top,bottom,straight,center=0,n=192) => {
    const points = [];
    for (const [sign,end] of [[1,top],[-1,bottom]]) {
      const reach = Math.abs(end)-straight;
      for (let i = 0; i <= n; i++) {
        const a = (sign>0?0:Math.PI)+Math.PI*i/n;
        points.push([center+halfWidth*Math.cos(a),sign*straight+reach*Math.sin(a)]);
      }
    }
    return poly(points);
  };
  const innerY = extent(source.inner,1), outerX = extent(source.outer,0), outerY = extent(source.outer,1);
  const hole = oval(workingRadius,Math.max(...innerY),Math.min(...innerY),workingHalfHeight);
  const outerCenter = (Math.max(...outerX)+Math.min(...outerX))/2;
  const outer = clip.intersection(oval((Math.max(...outerX)-Math.min(...outerX))/2,Math.max(...outerY),Math.min(...outerY),.30,outerCenter),
    poly([[rodRoots[0],-3],[rodRoots[1],-3],[rodRoots[1],3],[rodRoots[0],3]]));
  const yokeProfile = clip.difference(outer,hole);
  attach('yoke',plate(yokeProfile,-depth/2,depth/2),'yoke',PALETTE.brass);
  const sheaveProfile = clip.difference(poly(circle(offset,radius,256)),poly(circle([0,0],shaftRadius+.001,128)));
  attach('sheave',plate(sheaveProfile,-depth/2,depth/2),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.82,.30,128),'input',PALETTE.ink);
  // Brown hatches the exposed shaft end as a section; the model shows the
  // plain end of the shaft itself (no hatch notation).
  attach('collar',ring(shaftRadius+.001,source.collarRadius/scale,depth/2,.28,128),'input',PALETTE.driver);

  // The rods work in fixed guides (Brown's text). Each guide sits just past
  // the plate's edge, beyond the stub Brown breaks off at rodTips, and is
  // carried from behind by a narrow web on one plain tie bar. The bar runs
  // behind the rods (hidden by them in the plate's view) and also carries
  // the shaft's rear bearing, so guides and bearing form one frame.
  const guideHalfLength = .11, guideCenter = Math.max(...rodTips.map(Math.abs))+guideHalfLength+.50;
  const rodEnd = guideCenter+guideHalfLength+eccentricity+.04, rodRadius = source.rodRadius/scale;
  const guideZWall = -.62, tieHalfHeight = .12;
  for (const [i,sign] of [-1,1].entries()) {
    // The stub Brown draws and its run on into the guide are coaxial pieces
    // of the same rigid yoke.
    const tip = rodTips[i];
    for (const [name,ends] of [['rod'+i,[rodRoots[i],tip]],['rodExtension'+i,[tip,sign*rodEnd]]]) {
      const rod = attach(name,disk(rodRadius,...ends.sort((a,b)=>a-b),96),'yoke',PALETTE.brass);
      rod.rotation.y = Math.PI/2;
    }
    for (const mesh of wallGuide({name:'guide'+i,axis:'x',halfLength:guideHalfLength,boreRadius:rodRadius+.005,
      outerRadius:.24,zWall:guideZWall})) {
      mesh.position.x += sign*guideCenter;
      attach(mesh.name,mesh.geometry,'frame',PALETTE.muted,mesh.position.toArray()).rotation.copy(mesh.rotation);
    }
  }
  const tieEnd = guideCenter+guideHalfLength;
  // A round boss (hidden behind the sheave) carries the bar round the bore.
  attach('guideTieBar',plate(clip.difference(clip.union(poly([[-tieEnd,-tieHalfHeight],[tieEnd,-tieHalfHeight],[tieEnd,tieHalfHeight],[-tieEnd,tieHalfHeight]]),
    poly(circle([0,0],.38,128))),poly(circle([0,0],shaftRadius+.002,128))),guideZWall-.07,guideZWall),'frame',PALETTE.muted);
  attach('shaftSupport',ring(shaftRadius+.002,.36,guideZWall,-.50,128),'frame',PALETTE.muted);
  // Runs and supports past Brown's crop stay out of the plate-framing fit.
  for(const [name,mesh] of Object.entries(parts))if(/^(rodExtension|guide\d|shaftSupport)/.test(name))mesh.userData.beyondPlateCrop=true;
  blocks.yoke.position.x = offset[0];
  Object.assign(root.userData,{parts,families,blocks,source,hideGround:true,
    profiles:{tracedHole,hole,outer,yoke:yokeProfile},
    geometry:{offset,eccentricity,radius,shaftRadius,depth,clearance,workingHalfHeight,rodRoots,rodTips,rodEnd,rodRadius,guideCenter,guideHalfLength,guideZWall,baseTop}});
  markShadows(root); root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,-.15,0),cameraDirection:new THREE.Vector3(.7,.4,10)};
}
