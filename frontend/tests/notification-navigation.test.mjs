import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationDestination, loadNotificationDestination, NotificationNavigationError } from '../src/utils/notificationNavigation.js';

const base = { id: 1, groupId: 42, senderId: 7 };
for (const [type, content, view, chatTab, memberId] of [
  ['MESSAGE', 'You have a new message', 'chat', 'private', 7],
  ['MESSAGE', 'You have a new group message', 'chat', 'group', null],
  ['NUDGE', 'Where are you?', 'map', 'private', 7],
  ['NUDGE', 'I am on my way', 'map', 'private', 7],
  ['ARRIVED', 'I have arrived', 'map', 'private', 7]
]) test(`notification destination: ${type} / ${content}`, () => {
  assert.deepEqual(notificationDestination({ ...base, type, content }), { view, chatTab, groupId: 42, memberId });
});

function fixture() {
  const calls = [];
  const record = (method, result) => async id => { calls.push([method, id]); return result; };
  return { calls, api: {
    group: record('group', { id: 42, name: 'Referenced group', myRole: 'OWNER' }),
    members: record('members', [{ id: 300, userId: 7, name: 'Referenced member' }, { id: 301, userId: 1 }]),
    groupSharing: record('sharing', { sharingEnabled: false }),
    meeting: record('meeting', { id: 80, name: 'Meeting' }),
    groupRequests: record('requests', [])
  } };
}
const privateMessage = { ...base, type: 'MESSAGE', content: 'You have a new message' };
test('loads the referenced group and matches sender userId rather than membership id', async () => {
  const { api, calls } = fixture();
  const destination = await loadNotificationDestination(privateMessage, api, 1);
  assert.equal(destination.group.id, 42); assert.equal(destination.selected.userId, 7); assert.equal(destination.selected.id, 300);
  assert.ok(calls.every(([, id]) => id === 42)); assert.equal(destination.sharing.sharingEnabled, false);
});
test('unknown types, ambiguous message content and invalid references do not request a group', async () => {
  const { api, calls } = fixture();
  for (const invalid of [
    { ...base, type: 'REQUEST', requestId: 10 }, { ...base, type: 'MESSAGE', content: 'Unknown message' },
    { ...privateMessage, groupId: null }, { ...privateMessage, groupId: '42' },
    { ...privateMessage, senderId: null }, { ...privateMessage, senderId: -1 }
  ]) await assert.rejects(loadNotificationDestination(invalid, api, 1), NotificationNavigationError);
  assert.equal(calls.length, 0);
});
for (const status of [400, 403, 404, 410]) test(`unavailable or denied group (${status}) does not load a destination`, async () => {
  const { api, calls } = fixture(); api.group = async () => { throw Object.assign(new Error('server details'), { status }); };
  await assert.rejects(loadNotificationDestination(privateMessage, api, 1), error => error instanceof NotificationNavigationError && /صلاحية|متاح/.test(error.message) && !error.message.includes('server details'));
  assert.equal(calls.length, 0);
});
test('expired session remains a 401 so authentication handling can run', async () => {
  const { api } = fixture(); const expired = Object.assign(new Error('Session expired'), { status: 401 }); api.group = async () => { throw expired; };
  await assert.rejects(loadNotificationDestination(privateMessage, api, 1), error => error === expired);
});
test('missing member and self-directed private chat are rejected', async () => {
  const { api } = fixture(); api.members = async () => [{ userId: 1 }];
  await assert.rejects(loadNotificationDestination(privateMessage, api, 1), NotificationNavigationError);
  await assert.rejects(loadNotificationDestination({ ...privateMessage, senderId: 1 }, api, 1), NotificationNavigationError);
});
test('group conversation remains available if its original sender has left', async () => {
  const { api } = fixture(); api.members = async () => [{ userId: 1 }];
  const result = await loadNotificationDestination({ ...base, type: 'MESSAGE', content: 'You have a new group message' }, api, 1);
  assert.equal(result.chatTab, 'group'); assert.equal(result.selected, null);
});
test('no meeting point does not prevent opening an existing conversation', async () => {
  const { api } = fixture(); api.meeting = async () => { throw new Error('This group has no meeting point yet'); };
  assert.equal((await loadNotificationDestination(privateMessage, api, 1)).meeting, null);
});
test('wrong group response and invalid members are rejected', async () => {
  const { api } = fixture(); const correctGroup = api.group; api.group = async () => ({ id: 99 });
  await assert.rejects(loadNotificationDestination(privateMessage, api, 1), NotificationNavigationError);
  api.group = correctGroup; api.members = async () => null;
  await assert.rejects(loadNotificationDestination(privateMessage, api, 1), NotificationNavigationError);
});
test('network failure gives a safe connection message without returning partial state', async () => {
  const { api } = fixture(); api.groupSharing = async () => { throw Object.assign(new Error('internal details'), { status: 0 }); };
  await assert.rejects(loadNotificationDestination(privateMessage, api, 1), error => /الاتصال/.test(error.message) && !error.message.includes('internal details'));
});

test('App opens the referenced private chat and Forward works while Back is still loading notifications', async () => {
  const [{ default: React }, { default: Renderer, act }, { build }, { createRequire }, { fileURLToPath, pathToFileURL }] = await Promise.all([
    import('react'), import('react-test-renderer'), import('esbuild'), import('node:module'), import('node:url')
  ]);
  const require = createRequire(import.meta.url);
  const code = await build({ stdin: { contents: "import './src/main.jsx';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, loader: { '.css': 'empty' }, plugins: [{ name: 'app-fixture', setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true }));
    b.onResolve({ filter: /^(react-dom\/client|qrcode|react-leaflet)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'qrcode' ? 'export default {toDataURL:async()=>"data:image/png;base64,test"};' : args.path === 'react-leaflet' ? 'export const MapContainer=()=>null,TileLayer=()=>null,CircleMarker=()=>null,Popup=()=>null,Tooltip=()=>null,Polyline=()=>null,useMap=()=>({}),useMapEvents=()=>({});' : 'export function createRoot(){return {render:element=>{globalThis.__dalNotificationApp=element;}};}' }));
  } }] });
  const keys = ['window', 'document', 'navigator', 'history', 'location', 'localStorage', 'fetch', '__dalNotificationApp'];
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const window = Object.assign(new EventTarget(), { scrollTo() {}, screen: { orientation: { angle: 0 } } });
  const document = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible', documentElement: {}, getElementById: () => ({}) });
  const entries = [{}]; let index = 0;
  const pop = () => window.dispatchEvent(Object.assign(new Event('popstate'), { state: entries[index] }));
  const history = { get state() { return entries[index]; }, replaceState(state) { entries[index] = state; }, pushState(state) { entries.splice(++index, entries.length, state); }, back() { index--; pop(); }, forward() { index++; pop(); } };
  let read = false, lists = 0, groupLoads = 0, releaseList, tree;
  const notification = { ...privateMessage, senderName: 'Referenced member', createdAt: '2026-10-14T09:00:00Z' };
  const globals = { window, document, history, location: new URL('http://localhost/'), navigator: { onLine: true }, localStorage: { getItem: () => null, setItem() {} }, fetch: async url => {
    const path = new URL(url, 'http://localhost').pathname.replace('/api/v1', ''); let data;
    if (path === '/user/profile') data = { id: 1, name: 'Test user' };
    else if (path === '/group/my' || path === '/join-request/my') data = [];
    else if (path === '/security/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'test' };
    else if (path === '/notification/unread-count') data = { count: read ? 0 : 1 };
    else if (path === '/notification/1/read') { read = true; data = { ...notification, readAt: '2026-10-14T09:01:00Z' }; }
    else if (path === '/notification/my') {
      if (++lists === 3) await new Promise(resolve => { releaseList = resolve; });
      data = { content: [{ ...notification, readAt: read ? '2026-10-14T09:01:00Z' : null }] };
    } else if (path === '/group/42') { groupLoads++; data = { id: 42, name: 'Referenced group', myRole: 'MEMBER' }; }
    else if (path === '/group-member/group/42') data = [{ id: 300, userId: 7, name: 'Referenced member' }, { id: 301, userId: 1 }];
    else if (path.startsWith('/sharing')) data = { sharingEnabled: true };
    else if (path === '/meeting-point/group/42') data = null;
    else if (path === '/message/group/42/with/7') data = { content: [], last: true };
    else throw new Error('Unexpected test API: ' + path);
    return new Response(JSON.stringify(data));
  } };
  const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
    act(() => { tree = Renderer.create(globalThis.__dalNotificationApp); }); await flush();
    const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
    act(() => tree.root.findByProps({ className: 'bottom-nav' }).findAllByType('button').find(button => text(button) === 'المجموعات').props.onClick()); await flush();
    act(() => tree.root.findByProps({ 'aria-label': 'الإشعارات' }).props.onClick()); await flush();
    await act(async () => tree.root.findAllByType('button').find(button => button.props.className?.startsWith('notification-item')).props.onClick());
    assert.equal(tree.root.findByProps({ 'aria-label': 'عضو المحادثة' }).props.value, 7);
    assert.ok(text(tree.root.findByProps({ className: 'chat-heading' })).includes('Referenced group')); assert.equal(read, true);
    act(() => history.back()); await flush(); assert.equal(typeof releaseList, 'function');
    assert.ok(tree.root.findAllByType('h1').some(heading => text(heading) === 'تنبيهاتك'));
    act(() => history.forward()); await flush();
    assert.equal(tree.root.findByProps({ 'aria-label': 'عضو المحادثة' }).props.value, 7); assert.equal(groupLoads, 2);
    releaseList(); await flush(); assert.equal(tree.root.findAllByProps({ className: 'chat-page' }).length, 1);
  } finally {
    releaseList?.(); if (tree) act(() => tree.unmount());
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
