import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

// Preserve a specific already-running long study whose indented report would
// exceed V8's single-string limit. Only that report's indentation is changed;
// no solver state, values, source files or other serialization is modified.
const pid = Number(process.argv[2]), prefix = 'artifacts/review/082-sixteenth-ms-compact-output-change';
assert(Number.isInteger(pid) && pid > 1);
const cwd = fs.readlinkSync('/proc/' + pid + '/cwd');
const command = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').filter(Boolean);
const environment = Object.fromEntries(fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0').filter(Boolean).map(entry => {
  const i = entry.indexOf('='); return [entry.slice(0, i), entry.slice(i + 1)];
}));
assert.equal(cwd, process.cwd()); assert.deepEqual(command.slice(1), ['scripts/study-treadle-ratchet-dynamics.mjs']);
assert.equal(environment.PROBE_OUTPUT, 'artifacts/review/082-settling-sixteenth-ms-dynamics.json');
assert.equal(Number(environment.PROBE_DT), .0000625); assert.equal(Number(environment.PROBE_DURATION), 48);
assert.equal(environment.PROBE_RESUME, 'artifacts/review/082-startup-sixteenth-ms-dynamics.json');
assert(!fs.existsSync(prefix + '.json'));
const endpoint = 'http://127.0.0.1:9229/json/list';
if (await fetch(endpoint).then(r => r.json()).catch(() => null)) throw Error('Inspector port already occupied');
process.kill(pid, 'SIGUSR1');
let targets;
for (let i = 0; i < 50 && !targets; i++) {
  targets = await fetch(endpoint).then(r => r.json()).catch(() => null);
  if (!targets) await new Promise(resolve => setTimeout(resolve, 100));
}
assert.equal(targets?.length, 1, 'Expected one newly opened inspector');
const WebSocket = createRequire(import.meta.url)('ws');
const socket = new WebSocket(targets[0].webSocketDebuggerUrl), requests = new Map();
let sequence = 0, paused = false, resolvePause;
const pauseEvent = new Promise(resolve => {resolvePause = resolve;});
socket.on('message', bytes => {
  const message = JSON.parse(bytes);
  if (message.id) {
    const request = requests.get(message.id); requests.delete(message.id);
    if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
  } else if (message.method === 'Debugger.paused') {paused = true; resolvePause(message.params);}
  else if (message.method === 'Debugger.resumed') paused = false;
});
await new Promise((resolve, reject) => {socket.once('open', resolve); socket.once('error', reject);});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; requests.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));
});
const expression = `(() => {
  if (process.pid !== ${pid}) throw Error('Wrong process');
  if (globalThis.__treadleOutputFormatting) throw Error('Formatting patch already installed');
  const original = JSON.stringify;
  const record = {pid: process.pid, applied: 0, report: '082-settling-sixteenth-ms-dynamics', format: 'compact-json'};
  JSON.stringify = function(value, replacer, space) {
    if (value?.movement === 82 && value.dt === .0000625 && value.duration === 48
        && value.resumeFile === 'artifacts/review/082-startup-sixteenth-ms-dynamics.json'
        && Array.isArray(value.rows) && value.rows.length > 500000) {
      record.applied++;
      process.stderr.write('082 output formatting: compact JSON for ' + value.rows.length + ' states\\n');
      return original(value, replacer);
    }
    return original(value, replacer, space);
  };
  globalThis.__treadleOutputFormatting = record;
  if (JSON.stringify({probe: 1}, null, 2) !== original({probe: 1}, null, 2)) throw Error('Unrelated formatting changed');
  return {record, originalWasNative: original.toString().includes('[native code]')};
})()`;
try {
  await send('Debugger.enable'); await send('Debugger.pause'); const pause = await pauseEvent;
  const frame = pause.callFrames.find(f => f.url.endsWith('/scripts/study-treadle-ratchet-dynamics.mjs'));
  let stateAtPause = null;
  if (frame) {
    const result = await send('Debugger.evaluateOnCallFrame', {callFrameId: frame.callFrameId,
      expression: '({time:state.time,rows:rows.length,output})', returnByValue: true});
    if (!result.exceptionDetails) stateAtPause = result.result.value;
  }
  const result = await send('Runtime.evaluate', {expression, returnByValue: true});
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  assert.equal(result.result.value.record.pid, pid); assert(result.result.value.originalWasNative);
  const file = 'scripts/compact-treadle-study-output.mjs', archive = prefix + '-source.txt';
  fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(prefix + '.json', JSON.stringify({status: 'target-report-indentation-patch-installed', pid, cwd, command,
    created: new Date().toISOString(), stateAtPause, verification: result.result.value, expression,
    source: {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')},
    reason: 'Earlier 256001-state settling report is 214599462 indented bytes. Scaling to 768001 exceeds V8 MAX_STRING_LENGTH 536870888; compact output is estimated near 401 MB.',
    scope: 'The one matching movement-82 48-second continuation report uses native JSON serialization with no indentation. Solver state, data values, other serialization and source files are unchanged.'}, null, 2) + '\n', {flag: 'wx'});
  console.log({pid, stateAtPause, installed: true});
} finally {
  if (paused) await send('Debugger.resume');
  await send('Debugger.disable'); socket.close();
}
