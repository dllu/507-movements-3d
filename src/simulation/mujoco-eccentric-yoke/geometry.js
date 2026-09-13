import * as THREE from 'three';
import source from './source.js';
import {cubicPolyline} from '../cubic-polyline.js';
import {plate, poly, circle, capsule, disk, ring, polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from '../primitives.js';

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
  const rodRoots = source.rodRoots.map(x => (x-cx)/scale);
  const tracedHole = outline(source.inner.map(yokePoint));
  // Rectify the working faces to parallel planes throughout the center's
  // vertical sweep, with a small end margin. Retain the larger engraved lobes.
  // The bowed ink otherwise both interferes with the disk and introduces a
  // variable clearance. Machining these faces is a reconstruction assumption.
  const workingHalfHeight = eccentricity+.01, workingRadius = radius+clearance;
  const sweptHole = capsule([0,-workingHalfHeight],[0,workingHalfHeight],workingRadius,128);
  const straightWidth = poly([[-workingRadius,-3],[workingRadius,-3],[workingRadius,3],[-workingRadius,3]]);
  const hole = clip.union(clip.intersection(tracedHole,straightWidth),sweptHole);
  const outer = clip.intersection(outline(source.outer.map(yokePoint)),
    poly([[rodRoots[0],-3],[rodRoots[1],-3],[rodRoots[1],3],[rodRoots[0],3]]));
  const yokeProfile = clip.difference(outer,hole);
  attach('yoke',plate(yokeProfile,-depth/2,depth/2),'yoke',PALETTE.brass);
  const sheaveProfile = clip.difference(poly(circle(offset,radius,256)),poly(circle([0,0],shaftRadius+.001,128)));
  attach('sheave',plate(sheaveProfile,-depth/2,depth/2),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.82,.30,128),'input',PALETTE.ink);
  attach('collar',ring(shaftRadius+.001,source.collarRadius/scale,depth/2,.28,128),'input',PALETTE.driver);

  const guideHalfLength = .11, guideCenter = Math.max(...rodRoots.map(Math.abs))+eccentricity+guideHalfLength+.07;
  const rodEnd = guideCenter+guideHalfLength+eccentricity+.04, rodRadius = source.rodRadius/scale;
  for (const [i,sign] of [-1,1].entries()) {
    const ends = [rodRoots[i],sign*rodEnd].sort((a,b)=>a-b);
    const rod = attach('rod'+i,disk(rodRadius,...ends,96),'yoke',PALETTE.brass);
    rod.rotation.y = Math.PI/2;
    const support = clip.difference(clip.union(poly(circle([0,0],.29,96)),
      poly([[-.10,baseTop],[.10,baseTop],[.10,0],[-.10,0]])),poly(circle([0,0],rodRadius+.005,96)));
    const guide = attach('guide'+i,plate(support,-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,[sign*guideCenter,0,0]);
    guide.rotation.y = Math.PI/2;
  }
  const bearing = clip.difference(clip.union(poly(circle([0,0],.38,128)),
    poly([[-.12,baseTop],[.12,baseTop],[.12,0],[-.12,0]])),poly(circle([0,0],shaftRadius+.002,128)));
  attach('shaftSupport',plate(bearing,-.73,-.48),'frame',PALETTE.muted);
  const baseHalfWidth = guideCenter+.32;
  attach('base',new THREE.BoxGeometry(2*baseHalfWidth,.15,1.14),'frame',PALETTE.muted,[0,baseTop-.075,-.29]);
  blocks.yoke.position.x = offset[0];
  Object.assign(root.userData,{parts,families,blocks,source,hideGround:true,
    profiles:{tracedHole,hole,outer,yoke:yokeProfile},
    geometry:{offset,eccentricity,radius,shaftRadius,depth,clearance,workingHalfHeight,rodRoots,rodEnd,rodRadius,guideCenter,guideHalfLength,baseTop}});
  markShadows(root); root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,-.15,0),cameraDirection:new THREE.Vector3(.7,.4,10)};
}
