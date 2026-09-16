import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';

// Finite planar counterpart of a bent forged link, with actual hinge bores.
export function boreCurvedLink(mesh, radius, depth, holes) {
  const path=mesh.userData.centerline.getPoints(32);
  const outline=clip.union(...path.slice(1).map((p,i)=>capsule(
    [path[i].x,path[i].y],[p.x,p.y],radius,12)),
    ...holes.map(h=>poly(circle([h.x,h.y],h.radius+.045,48))));
  const shape=clip.difference(outline,...holes.map(h=>poly(circle([h.x,h.y],h.radius,64))));
  mesh.geometry.dispose();
  mesh.geometry=plate(shape,path[0].z-depth/2,path[0].z+depth/2);
}
