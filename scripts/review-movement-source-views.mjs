// Reusable production-route captures for independent source review. Capturing
// images is not itself visual approval; inspect them before updating the ledger.
import {chromium} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';

const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([^=]+)=(.+)$/.exec(arg);
  if (!match) throw new Error('Use --ids=1,2 --output-dir=/dev/shm/review [--base-url=http://127.0.0.1:44240] [--samples=33]');
  return match.slice(1);
}));
for (const key of Object.keys(options)) if (!['ids','output-dir','base-url','samples'].includes(key)) throw new Error(`Unknown option: ${key}`);
const ids = [...new Set((options.ids ?? '').split(',').map(Number))];
if (ids.some(id => !Number.isInteger(id) || id < 1 || id > 507)) throw new Error('IDs must be between 1 and 507');
if (!options['output-dir']) throw new Error('--output-dir is required; keep bulk captures outside Git');
const samples = Number(options.samples ?? 33);
if (!Number.isInteger(samples) || samples < 2) throw new Error('--samples must be at least 2');
const output = resolve(options['output-dir']);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const results = [], errors = [];
try {
  const page = await browser.newPage({viewport:{width:1400,height:850}});
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/#/about', options['base-url'] ?? 'http://127.0.0.1:44240').href);
  for (const id of ids) {
    const row = await page.evaluate(async ({id,samples}) => {
      window.sourceReview?.engine.dispose();
      const THREE = await import('/node_modules/three/build/three.module.js');
      const {MovementEngine} = await import('/src/simulation/async-engine.js');
      const {loadMovementModel} = await import('/src/simulation/model-loader.js');
      const catalog = await (await fetch('/src/data/movements.json')).json();
      const movement = catalog.movements[id-1];
      document.body.innerHTML = `<main style="display:flex;width:1400px;height:850px;background:#f3f0e9"><div id="source-stage" style="width:850px;height:850px"></div><img src="/engravings/mm_${String(id).padStart(3,'0')}.png" style="width:525px;object-fit:contain"/></main>`;
      const model = await loadMovementModel(movement);
      const engine = new MovementEngine(document.querySelector('#source-stage'), movement, {playing:false,model});
      cancelAnimationFrame(engine.animationFrame); engine.animationFrame = 0;
      window.sourceReview = {engine,THREE};
      const period = model.root.userData.geometry?.mechanismCyclePeriod ?? model.root.userData.animationTiming?.authoredCyclePeriod;
      if (!Number.isFinite(period) || period <= 0) throw new Error(`${id}: missing finite review period`);
      const point = new THREE.Vector3(), instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
      let maxNdc = 0, worst = null;
      const measure = (object, matrix, time) => {
        const positions = object.geometry.attributes.position;
        for (let i=0;i<positions.count;i++) {
          point.fromBufferAttribute(positions,i).applyMatrix4(matrix).project(engine.camera);
          if (![point.x,point.y,point.z].every(Number.isFinite)) throw new Error(`${id}: nonfinite projection`);
          const extent = Math.max(Math.abs(point.x),Math.abs(point.y));
          if (extent > maxNdc) {maxNdc=extent;worst={time,part:object.name || object.userData.role || object.type};}
        }
      };
      for (let i=0;i<samples;i++) {
        const time=period*i/(samples-1); model.update(time); model.root.updateMatrixWorld(true);
        model.root.traverseVisible(object => {
          if (!object.geometry?.attributes.position) return;
          if (object.isInstancedMesh) {
            for (let j=0;j<object.count;j++) {object.getMatrixAt(j,instance);transform.multiplyMatrices(object.matrixWorld,instance);measure(object,transform,time);}
          } else measure(object,object.matrixWorld,time);
        });
      }
      model.update(0);engine.renderer.render(engine.scene,engine.camera);
      return {id,period,samples,maxNdc,worst,drawCalls:engine.renderer.info.render.calls,triangles:engine.renderer.info.render.triangles};
    }, {id,samples});
    await page.screenshot({path:join(output,`${id}-default.png`)});
    await page.evaluate(period => {
      const {engine,THREE}=window.sourceReview;
      engine.model.update(period*.4);engine.fitCamera(new THREE.Vector3(5,3,12));engine.renderer.render(engine.scene,engine.camera);
    }, row.period);
    await page.screenshot({path:join(output,`${id}-oblique.png`)});
    results.push(row);
    console.log(JSON.stringify(row));
    await writeFile(join(output,'report.json'),JSON.stringify({results,errors},null,2)+'\n');
  }
  if (errors.length || results.some(row=>row.maxNdc>1)) process.exitCode=1;
} finally {
  await browser.close();
  await writeFile(join(output,'report.json'),JSON.stringify({results,errors},null,2)+'\n');
}
