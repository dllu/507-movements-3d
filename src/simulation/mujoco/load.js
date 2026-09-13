import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';

let loading;

// Vite emits the WASM beside our own assets, including on nested static hosts.
// All models in this page share one runtime, with separate MjModel/MjData pairs.
export function getMujoco() {
  loading ??= loadMujoco({locateFile: file => file.endsWith('.wasm') ? wasmUrl : file})
    .catch(error => { loading = undefined; throw error; });
  return loading;
}
