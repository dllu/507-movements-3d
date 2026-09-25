import * as THREE from 'three';
import {LaidRopeGeometry,replaceWithLaidRope} from '../laid-rope.js';

// Brown hatches both cords as laid rope: the shared three-strand rope on a
// smooth curve through the native cord sections. Each path starts at a cord
// end, so arc length is the material coordinate and the lay stays with the
// sections as they move.
const cordCurve=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
export function bellCrankCordGeometry(points,radius){return new LaidRopeGeometry(cordCurve(points),points.length*4,radius,8,false);}
export function updateBellCrankCord(mesh,points,radius){return replaceWithLaidRope(mesh,cordCurve(points),{radius,tubularSegments:points.length*4});}
