// Print one movement's full body-intersection screen row (all pairs).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [id, ...rest] = process.argv.slice(2);
const script = fileURLToPath(new URL('./screen-body-intersections.mjs', import.meta.url));
const row = JSON.parse(execFileSync(process.execPath, [script, `--worker=${id}`, ...rest], { maxBuffer: 64 << 20 }).toString().trim().split('\n').at(-1));
console.log(`${row.id}: ${row.bodies} bodies, ${row.meshes} meshes, spacing ${row.spacing.toFixed(4)}, open: ${row.openMeshes.join('; ') || 'none'}`);
for (const p of row.pairs) console.log(`  ${p.kind.padEnd(9)} ${p.depth.toFixed(4)} @${p.time.toFixed(3)} ${p.pair}`);
