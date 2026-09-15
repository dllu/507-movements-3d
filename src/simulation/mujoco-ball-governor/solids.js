import {makeBallGovernorUpdater} from './update-solids.js';
import * as THREE from 'three';
import { plate, poly, circle, capsule, ring, disk, turned, polygonClipping as clip } from '../finite-plate-geometry.js';
import { PALETTE, matte, markShadows } from '../primitives.js';
import { disposeObject3D } from '../dispose-model.js';
import { governorGeometry, governorEquilibrium } from './equilibrium.js';
import { makeGovernorBevelPair } from './bevel-pair.js';

// Visible geometry accepts native coordinates; it does not solve equilibrium or
// hide a simulation clock. Remote valve hardware is outside the engraving.
export function makeBallGovernorSolids() {
  const g = governorGeometry(), root = new THREE.Group(), parts = {}, blocks = {}, families = {};
  const materials = new Map(), bevel = makeGovernorBevelPair();
  root.add(bevel.root);
  const group = (name, parent = root) => {
    const block = new THREE.Group(); block.name = 'body:' + name;
    parent.add(block); blocks[name] = block; return block;
  };
  const fixed = group('fixed'), rotor = group('rotor'), sleeve = group('sleeve', rotor), output = group('output');
  const add = (name, geometry, family, color, point = [0, 0, 0]) => {
    if (!materials.has(color)) { const m = matte(color); m.fog = false; materials.set(color, m); }
    const mesh = new THREE.Mesh(geometry, materials.get(color));
    mesh.name = name; mesh.position.set(...point); blocks[family].add(mesh);
    parts[name] = mesh; families[name] = family; return mesh;
  };
  const axialY = geometry => geometry.rotateX(-Math.PI / 2);
  const pixel = ([x, y]) => [(x - 279) * .018, g.topY + (145 - y) * .018];
  const imagePoly = points => poly(points.map(pixel));
  const headShape = imagePoly([[248,148],[251,140],[261,137],[267,132],[291,132],[295,139],[305,140],[311,147],[310,154],[302,159],[294,160],[289,170],[268,170],[264,160],[255,158],[249,154]]);
  const headHoles = [-1, 1].map(sign => poly(circle([sign * g.pivotRadius, g.topY], .069, 64)));
  for (const [name, low, high] of [['headRear', -.24, -.12], ['headFront', .12, .24]]) {
    add(name, plate(clip.difference(headShape, ...headHoles), low, high), 'rotor', PALETTE.driven);
  }
  add('headHub', axialY(ring(.104, .24, g.topY - .51, g.topY + .24, 96)), 'rotor', PALETTE.driven);
  add('spindle', axialY(disk(.10, pixel([279,499])[1], 4.30, 96)), 'rotor', PALETTE.ink);
  add('inputHub',ring(.10,.20,-.29,-.25,96),'fixed',PALETTE.ink,[0,bevel.root.userData.parameters.apex[1],0]);
  add('inputShaft', disk(.10, -.76, -.28, 96), 'fixed', PALETTE.ink, [0, bevel.root.userData.parameters.apex[1], 0]);
  // The two shallow source collars are fixed bearing housings with real bores.
  for (const [name, y, radius, height] of [['upperBearing',100,.378,.216],['middleCollar',311,.162,.18]]) {
    const center = pixel([279,y])[1];
    add(name, axialY(ring(.106, radius, center-height/2, center+height/2,96)), 'fixed', PALETTE.frame);
  }
  const sourceSleeveY = governorEquilibrium(g.initialSpread, g).sleeveY;
  // Sleeve barrel and flanges rotate; the output fork fits the annular groove.
  add('sleeveBarrel', axialY(ring(.106,.19,-.66,.13,96)), 'sleeve', PALETTE.accent);
  for (const [name,lo,hi] of [['sleeveUpperFlange',-.39,-.31],['sleeveLowerFlange',-.72,-.64]]) {
    add(name, axialY(ring(.19,.27,lo,hi,96)), 'sleeve', PALETTE.accent);
  }
  add('sleeveShoulder',axialY(turned([[.04,.106],[.04,.24],[.12,.24],[.36,.112],[.36,.106]],96)),'sleeve',PALETTE.accent);
  add('sleeveTopStem',axialY(ring(.106,.112,.35,.50,96)),'sleeve',PALETTE.accent);
  add('sleeveTopFlange',axialY(ring(.106,.234,.46,.52,96)),'sleeve',PALETTE.accent);
  const crossbar = clip.difference(capsule([-g.sleeveRadius,0],[g.sleeveRadius,0],.12,48),
    ...[-1,1].map(sign=>poly(circle([sign*g.sleeveRadius,0],.069,64))));
  add('sleeveCrossbar', plate(clip.difference(crossbar,poly([[-.112,-.2],[.112,-.2],[.112,.2],[-.112,.2]])),-.10,.10), 'sleeve', PALETTE.accent);
  for (const sign of [-1, 1]) {
    const name = sign < 0 ? 'left' : 'right';
    const upper = group(name + 'Upper', rotor), lower = group(name + 'Lower', rotor);
    upper.position.set(sign*g.pivotRadius,g.topY,0);
    const upperShape = clip.union(capsule([0,0],[0,-g.ballArm+.50],.081,48),
      poly(circle([0,0],.16,64)), poly(circle([0,-g.elbowArm],.16,64)));
    const holes = [0,-g.elbowArm].map(y=>poly(circle([0,y],.069,64)));
    add(name+'UpperArm',plate(clip.difference(upperShape,...holes),-.075,.075),name+'Upper',PALETTE.driven);
    add(name+'Ball',new THREE.SphereGeometry(g.ballRadius,48,32),name+'Upper',PALETTE.driver,[0,-g.ballArm,0]);
    const lowerShape=clip.difference(clip.union(capsule([0,0],[0,-g.lowerLink],.065,48),
      poly(circle([0,0],.13,64)),poly(circle([0,-g.lowerLink],.12,64))),
      ...[0,-g.lowerLink].map(y=>poly(circle([0,y],.069,64))));
    add(name+'LowerLink',plate(lowerShape,.12,.24),name+'Lower',PALETTE.ink);
    add(name+'TopPin',disk(.065,-.27,.27,64),'rotor',PALETTE.ink,[sign*g.pivotRadius,g.topY,0]);
    add(name+'ElbowPin',disk(.065,-.09,.27,64),name+'Upper',PALETTE.ink,[0,-g.elbowArm,0]);
    add(name+'SleevePin',disk(.065,-.12,.27,64),'sleeve',PALETTE.ink,[sign*g.sleeveRadius,0,0]);
  }
  // Horizontal fork plates are drawn edge-on. Their unseen depth and rear jaw
  // are inferred; the cut end denotes the unshown remote valve connection.
  const forkShape = (length, outer, bore) => clip.difference(clip.union(
    poly([[-length,-.11],[-.22,-.11],[-.22,.11],[-length,.11]]),
    poly(circle([0,0],outer,96))), poly(circle([0,0],bore,96)),
    poly([[.05,-bore],[outer+.1,-bore],[outer+.1,bore],[.05,bore]]));
  const horizontal = (shape, low, high) => plate(shape,low,high).rotateX(-Math.PI/2);
  add('outputFork',horizontal(forkShape(2.268,.255,.197),-.64,-.44),'output',PALETTE.brass);
  const baseY = pixel([279,480])[1];
  const supportShape=clip.difference(poly([[-2.322,-.32],[-.17,-.32],[-.17,.32],[-2.322,.32]]),
    capsule([-2.5,0],[-.55,0],.13,48));
  const support=horizontal(supportShape,-.07,.07).rotateX(.43);
  add('lowerSupport',support,'fixed',PALETTE.frame,[0,baseY,0]);
  add('lowerBearing',axialY(ring(.106,.20,baseY-.10,baseY+.30,96)),'fixed',PALETTE.frame);
  add('spindleEndEye',ring(.065,.153,-.05,.05,64),'rotor',PALETTE.ink,[0,pixel([279,503])[1],0]);
  // Solid-to-solid joins within a rigid part are deliberate: head cheeks/hub,
  // sleeve barrel/crossbar and arm stems embedded in their balls.
  const update = makeBallGovernorUpdater(root);
  Object.assign(root.userData,{parts,blocks,families,hideGround:true,sourceScale:.018,
    reconstructionNote:'Unregistered native-driven solids. Joint depths, rear cheeks and bearing supports inferred; valve and remote fork linkage not drawn. Effective native masses are retained rather than derived from decorative geometry.'});
  update({spindle:0,leftSpread:g.initialSpread,rightSpread:g.initialSpread,sleeveY:sourceSleeveY,qpos:[0,0,0,0,0,0]});
  markShadows(root);
  return {root,update,dispose:()=>disposeObject3D(root)};
}
