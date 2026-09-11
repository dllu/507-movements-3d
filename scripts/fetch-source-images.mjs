import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('public/engravings');
const movementCount = 507;
const concurrency = 8;

await mkdir(outputDirectory, { recursive: true });

async function exists(path) {
  try {
    const details = await stat(path);
    return details.size > 0;
  } catch {
    return false;
  }
}

async function fetchImage(id) {
  const number = String(id).padStart(3, '0');
  const destination = resolve(outputDirectory, `mm_${number}.png`);
  if (await exists(destination)) return;

  // Most plates have one file per movement. A few source pages combine
  // neighboring figures (for example, 262–263), so try the small range names
  // used by the original site before reporting a missing engraving.
  const sourceNames = [`mm_${number}.png`];
  for (let span = 1; span <= 5; span += 1) {
    for (let start = Math.max(1, id - span); start <= id; start += 1) {
      const end = start + span;
      if (id <= end && end <= movementCount) {
        sourceNames.push(
          `mm_${String(start).padStart(3, '0')}-${String(end).padStart(3, '0')}.png`,
        );
      }
    }
  }

  for (const sourceName of sourceNames) {
    const source = `https://507movements.com/img/${sourceName}`;
    const response = await fetch(source);
    if (!response.ok) continue;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) continue;
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    return;
  }
  throw new Error(`Could not find a source engraving for Movement ${number}.`);
}

let nextId = 1;
async function worker() {
  while (nextId <= movementCount) {
    const id = nextId;
    nextId += 1;
    await fetchImage(id);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(`Source engravings are available in ${outputDirectory}.`);
