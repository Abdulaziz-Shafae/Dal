import { test } from 'node:test';
import assert from 'node:assert/strict';
// Load the production adapter with only Vite's compile-time env expression substituted.
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../src/api.js', import.meta.url), 'utf8')).replace('import.meta.env.VITE_API_BASE_URL', "''");
const loadAdapter = () => import('data:text/javascript;base64,' + Buffer.from(source + '\n// ' + Math.random()).toString('base64'));
test('stalled requests abort and surface a connection error instead of blocking navigation', async () => {
 const realTimer = globalThis.setTimeout, realClear = globalThis.clearTimeout;
 let signal;
 try {
  globalThis.setTimeout = callback => { queueMicrotask(callback); return 123; };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (url, options) => { signal = options.signal; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })); };
  const { api } = await loadAdapter();
  await assert.rejects(api.locations(1), error => error.status === 0 && /الاتصال/.test(error.message));
  assert.equal(signal.aborted, true);
 } finally { globalThis.setTimeout = realTimer; globalThis.clearTimeout = realClear; }
});
test('login and mutation include session credentials and the server-provided CSRF header', async () => {
 const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(url.endsWith('/csrf') ? { token: 'token-1', headerName: 'X-CSRF-TOKEN' } : { id: 7, name: 'Test' }), { status: 200 }); };
 const { api } = await loadAdapter(); await api.login({ email: 'test@example.com', password: 'Valid123!' }); await api.pauseAll();
 assert.equal(calls.length, 4); assert.equal(calls[1].url, '/api/v1/user/login'); assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'token-1'); assert.equal(calls[1].options.credentials, 'include'); assert.equal(calls[2].url, '/api/v1/security/csrf'); assert.equal(calls[3].url, '/api/v1/sharing/pause'); assert.equal(calls[3].options.body, '{}');
});
test('a rejected mutation surfaces the server message and is not silently replayed', async () => {
 let mutations = 0; globalThis.fetch = async (url) => { if (url.endsWith('/csrf')) return new Response(JSON.stringify({ token: 'x', headerName: 'X-CSRF-TOKEN' })); mutations++; return new Response(JSON.stringify({ message: 'Only the owner can close this group' }), { status: 400 }); };
 const { api } = await loadAdapter(); await assert.rejects(api.closeGroup(1), /Only the owner/); assert.equal(mutations, 1);
});
test('messages preserve the intended recipient and the retry identity', async () => {
 let call; globalThis.fetch = async (url, options) => { if (url.endsWith('/csrf')) return new Response(JSON.stringify({ token: 'x', headerName: 'X-CSRF-TOKEN' })); call = { url, options }; return new Response('{}'); };
 const { api } = await loadAdapter(); await api.send(12, 5, { content: 'hello', clientMessageId: 'stable-123' }); assert.equal(call.url, '/api/v1/message/group/12/to/5'); assert.equal(JSON.parse(call.options.body).clientMessageId, 'stable-123');
});
test('a static hosting HTML response is not mistaken for authenticated data', async () => {
 globalThis.fetch = async () => new Response('<html>'); const { api } = await loadAdapter(); await assert.rejects(api.profile(), /رابط الباك إند/);
});

test('session expiry returned as 400 by the backend requests a new login', async () => {
 globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Your session has expired. Please log in again' }), { status: 400 });
 const { api } = await loadAdapter(); await assert.rejects(api.profile(), error => error.status === 401 && /الجلسة/.test(error.message));
});

test('CORS rejection and CSRF network failure have useful messages', async () => {
 globalThis.fetch = async () => new Response('Invalid CORS request', { status: 403 });
 const { api } = await loadAdapter(); await assert.rejects(api.profile(), /غير مسموح/);
 globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
 await assert.rejects(api.login({}), error => error.status === 0 && /تعذر الاتصال/.test(error.message));
});
