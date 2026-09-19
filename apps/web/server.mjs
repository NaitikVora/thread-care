import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer(async (req,res) => {
  try {
    const route = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target = path.resolve(root, '.' + (route === '/' ? '/index.html' : route));
    if (!target.startsWith(root)) {res.writeHead(403).end();return;}
    const body = await readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173),'127.0.0.1',()=>console.log('Thread Care: http://127.0.0.1:'+server.address().port));
