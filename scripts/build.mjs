import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
const publicFiles = {};
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
for (const file of await readdir('dist', { withFileTypes: true })) {
  if (!file.isFile()) continue;
  const extension = file.name.slice(file.name.lastIndexOf('.'));
  if (types[extension]) publicFiles['/'+file.name] = { body:await readFile('dist/'+file.name,'utf8'), type:types[extension] };
}
await mkdir('dist/server', { recursive:true });
await mkdir('dist/.openai', { recursive:true });
const api = (await readFile('backend/api.mjs','utf8')).replace("'../dist/domain.js'", "'./domain.js'");
await writeFile('dist/server/api.js', api);
await copyFile('dist/domain.js', 'dist/server/domain.js');
const worker = [
  "import { handleApi } from './api.js';",
  'const assets = '+JSON.stringify(publicFiles)+';',
  'export default { async fetch(request, env) {',
  "const route = new URL(request.url).pathname;",
  "if (route.startsWith('/api/')) return handleApi(request, env);",
  "if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});",
  "const asset = assets[route==='/'?'/index.html':route];",
  "if (!asset) return new Response('Not found',{status:404});",
  "return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'}});",
  '} };'
].join('\n');
await writeFile('dist/server/index.js',worker);
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built a self-contained Worker with '+Object.keys(publicFiles).length+' public assets and the AI API.');
