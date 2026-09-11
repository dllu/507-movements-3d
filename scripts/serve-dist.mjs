import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const portFlag = process.argv.indexOf('--port');
const port = Number.parseInt(
  portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT ?? '4173',
  10,
);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new RangeError('The static-server port must be an integer from 1 to 65535.');
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const distributionRoot = resolve(scriptDirectory, '..', 'dist');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
]);

function distributionPath(requestUrl) {
  let pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  // Mount the identical directory at both / and /portable/. The latter is an
  // integration check that every production URL remains relative when the
  // user copies dist beneath an arbitrary server subdirectory.
  if (pathname === '/portable') pathname = '/portable/';
  if (pathname.startsWith('/portable/')) pathname = pathname.slice('/portable'.length);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const candidate = resolve(distributionRoot, `.${pathname}`);
  if (candidate !== distributionRoot && !candidate.startsWith(`${distributionRoot}${sep}`)) {
    return null;
  }
  return candidate;
}

const server = createServer(async (request, response) => {
  const filePath = distributionPath(request.url ?? '/');
  if (!filePath) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const details = await stat(filePath);
    if (!details.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': details.size,
      'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Serving dist on http://127.0.0.1:${port}\n`);
});
