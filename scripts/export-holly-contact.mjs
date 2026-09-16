import fs from 'node:fs';
import {createAuthoredDoubleEllipticalRotaryEngineMovement} from '../src/simulation/authored-double-elliptical-rotary-engines.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
const model=createAuthoredDoubleEllipticalRotaryEngineMovement({id:429});
const {sourceProfiles,geometry,blocks}=model.root.userData;
const triangles=mesh=>surfaceTriangles(mesh.geometry).filter(t=>Math.abs(t.getNormal(t.a.clone()).z)>.9).map(t=>[t.a,t.b,t.c].map(p=>[p.x,p.y]));
fs.writeFileSync('/dev/shm/holly-contact.json',JSON.stringify({
  centerDistance:geometry.centerDistance,
  left:sourceProfiles.leftPoints.map(p=>p.map(x=>x*geometry.sourceScale)),
  right:sourceProfiles.rightPoints.map(p=>p.map(x=>x*geometry.sourceScale)),
  rendered:[triangles(blocks.leftPiston),triangles(blocks.rightPiston)],
}));
