import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { handleApi } from './backend/api.mjs';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
export function createServer(env = {}, apiOptions = {}) {
  const runtime = { ...env, SESSION_SECRET: env.SESSION_SECRET || randomBytes(32).toString('hex') };
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) { res.writeHead(403).end('Unrecognized host'); return; }
      const url = new URL(req.url, 'http://' + host);
      if (url.pathname.startsWith('/api/')) {
        const headers = new Headers();
        for (const [key,value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        const request = new Request(url, { method:req.method, headers, ...(!['GET','HEAD'].includes(req.method) ? {body:req,duplex:'half'} : {}) });
        const response = await handleApi(request, runtime, apiOptions);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const route = decodeURIComponent(url.pathname);
      const target = path.resolve(root, '.' + (route === '/' ? '/index.html' : route));
      if (!target.startsWith(root) || /\/(?:server|\.openai)(?:\/|$)/.test(route)) { res.writeHead(404).end(); return; }
      const body = await readFile(target);
      res.writeHead(200, { 'Content-Type':types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const server = createServer(process.env);
  server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Thread Care: http://127.0.0.1:' + server.address().port));
}
