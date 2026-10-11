import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const backend = process.env.BACKEND_URL ? new URL(process.env.BACKEND_URL) : null;
if (backend && !['http:', 'https:'].includes(backend.protocol)) throw new Error('BACKEND_URL must be HTTP or HTTPS');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
http.createServer(async (req, res) => {
 if (req.url.startsWith('/api/')) {
   if (!backend) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'الخدمة غير متصلة حاليًا. يرجى المحاولة لاحقًا.' })); return; }
   const target = new URL(req.url, backend.origin);
   const headers = { ...req.headers, host: target.host, 'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https', 'x-forwarded-host': req.headers.host };
   delete headers.connection;
   const proxy = (target.protocol === 'https:' ? https : http).request(target, { method: req.method, headers, timeout: 20000 }, upstream => {
     const responseHeaders = { ...upstream.headers }; delete responseHeaders.connection;
     res.writeHead(upstream.statusCode, responseHeaders); upstream.pipe(res);
   });
   proxy.on('timeout', () => proxy.destroy(new Error('Upstream timeout')));
   proxy.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); if (!res.writableEnded) res.end(JSON.stringify({ message: 'تعذر الوصول للخدمة. حاول مجددًا.' })); });
   req.pipe(proxy); return;
 }
 if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
 let requested;
 try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
 let filename = path.resolve(root, '.' + requested);
 if (!filename.startsWith(root + path.sep) && filename !== root) { res.writeHead(403); res.end(); return; }
 if (filename === root) filename = path.join(root, 'index.html');
 let bytes;
 try { bytes = await readFile(filename); }
 catch { if (path.extname(requested)) { res.writeHead(404); res.end(); return; } filename = path.join(root, 'index.html'); bytes = await readFile(filename); }
 res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': filename.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' });
 res.end(req.method === 'HEAD' ? undefined : bytes);
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
