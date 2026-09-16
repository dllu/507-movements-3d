import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createAuthoredCombinationDriveMovement} from '../src/simulation/authored-combination-drives.js';
import {createAuthoredFeatheringPaddleWheelMovement} from '../src/simulation/authored-feathering-paddle-wheels.js';
import {createAuthoredBoatDetacherMovement} from '../src/simulation/authored-boat-detachers.js';
const createMovementModel=m=>({261:createAuthoredCombinationDriveMovement,489:createAuthoredFeatheringPaddleWheelMovement,492:createAuthoredBoatDetacherMovement}[m.id])(m);
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const select=(root,re)=>{const list=[];root.traverse(o=>{if(o.geometry&&re.test(o.userData.role??''))list.push(o);});return list;};
function clear(a,points,b,surface){const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld);
 for(const p of points){const q=p.clone().applyMatrix4(transform);if(surface.box.distanceToPoint(q)>.005)continue;const d=surface.signedDistance(q,.005);assert.ok(d>=-1e-6,`${a.userData.role} into ${b.userData.role}: ${d}`);}}
function sweep(m,movers,targets,period,n=64){const a=movers.map(o=>[o,surfacePoints(o.geometry)]),b=targets.map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=n;i++){m.update(period*i/n);m.root.updateMatrixWorld(true);for(const[o,p]of a)for(const[t,s]of b)clear(o,p,t,s);}}
test('261 finite bored links clear their pins, drum and each other throughout winding and return',()=>{
 const m=createMovementModel(catalog[260]);
 const rods=select(m.root,/bored-constant-length-shank/);
 sweep(m,select(m.root,/fixed-rocker-pivot-G|eccentric-pin-on|joint-between-link/),rods,12);
 sweep(m,[rods[1]],select(m.root,/cord-winding-drum|revolving-disk-B$/).concat([rods[0]]),12);
});
test('489 ring seats on the eccentric and its bored cranks clear their actual driving pins',()=>{
 const m=createMovementModel(catalog[488]);
 sweep(m,select(m.root,/main-rotating-transverse-shaft|loose-annular-control-ring-d/),select(m.root,/fixed-stationary-eccentric-e/),4);
 sweep(m,select(m.root,/bucket-pivot-on-arm/),select(m.root,/radial-extension-of-ring/),4);
 sweep(m,select(m.root,/control-pin-at-end/),select(m.root,/rigid-arm-bar-b/),4);
 sweep(m,select(m.root,/bucket-pivot-on-arm|control-pin-at-end/),select(m.root,/bored-constant-length-shank|pivot-boss|crank-c-control-end|vertical-broad-face-of-bucket|blind-paddle/),4);
});
test('492 the transverse tongue end exits the closed eye without crossing its metal',()=>{
 const m=createMovementModel(catalog[491]);
 sweep(m,select(m.root,/curved-tongue-body/),select(m.root,/upper-eye-locking-tongue|boat-fixed-standard-plate/),10,128);
 sweep(m,select(m.root,/tongue-locking-stud|tongue-end-offset-neck/),select(m.root,/upper-eye-locking-tongue|upper-arm-of-release-lever/),10,128);
 sweep(m,select(m.root,/fixed-upper-tongue-hinge-pin|fixed-middle-lever-fulcrum-pin/),select(m.root,/curved-tongue-body|upper-arm-of-release-lever|lower-rope-arm/),10);
});
