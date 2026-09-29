import { chromium } from '@playwright/test';
const ids = process.argv.slice(2);
const b = await chromium.launch({channel:'chrome'});
for (const id of ids) {
  const p = await b.newPage({viewport:{width:1440,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.goto('http://127.0.0.1:43917/portable/#/movement/'+id);
  try { await p.locator('.simulation-canvas').waitFor({timeout:30000}); } catch { console.log(id,'NO CANVAS'); await p.close(); continue; }
  await p.waitForTimeout(500);
  const info = await p.evaluate(()=>({
    wasm: performance.getEntriesByType('resource').filter(r=>/\.wasm/.test(r.name)).length,
    buttons: [...document.querySelectorAll('.simulation-toolbar button')].map(b=>b.textContent.trim().replace(/\s+/g,' ')+(b.hasAttribute('aria-pressed')&&!b.classList.contains('play-control')?'['+b.getAttribute('aria-pressed')+']':'')),
    selects: [...document.querySelectorAll('.configuration-control')].map(l=>l.firstChild.textContent+':'+[...l.querySelectorAll('option')].map(o=>o.value).join('/')+'='+l.querySelector('select').value),
    note: document.querySelector('.reconstruction-notes')?.hidden ? null : document.querySelector('.reconstruction-notes p')?.textContent,
  }));
  console.log(JSON.stringify({id,...info,errs}));
  await p.close();
}
await b.close();
