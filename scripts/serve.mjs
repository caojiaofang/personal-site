import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

async function notFound(res, method) {
  res.writeHead(404, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' });
  res.end(method === 'HEAD' ? undefined : await readFile(path.join(root, '404.html')));
}

http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (relative.split(/[\\/]/).some(part => part.startsWith('.')) || relative.includes('\\')) { await notFound(res, req.method); return; }
    let filename = path.resolve(root, relative || 'index.html');
    if (filename !== root && !filename.startsWith(root + path.sep)) { await notFound(res, req.method); return; }
    let info;
    try { info = await stat(filename); } catch { await notFound(res, req.method); return; }
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
      filename = path.join(filename, 'index.html');
    }
    filename = await realpath(filename);
    const type = mime[path.extname(filename)];
    if (!filename.startsWith(root + path.sep) || !type) { await notFound(res, req.method); return; }
    info = await stat(filename);
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(filename));
  } catch { res.writeHead(400); res.end('请求无效'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
