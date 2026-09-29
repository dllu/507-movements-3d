import { chromium } from '@playwright/test';
const b = await chromium.launch({channel:'chrome'});
const p = await b.newPage({viewport:{width:1440,height:1000}});
await p.emulateMedia({reducedMotion:'reduce'});
await p.goto('http://127.0.0.1:43917/portable/#/movement/'+process.argv[2]);
const c=p.locator('.simulation-canvas'); await c.waitFor();
const t0=Date.now();
for(let i=0;i<30;i++){ console.log(Date.now()-t0, await c.evaluate(e=>[e.width,e.clientWidth, (()=>{const gl=e.getContext('webgl2');const i=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(i.UNMASKED_RENDERER_WEBGL)})()].join(' '))); await p.waitForTimeout(300);}
await b.close();
