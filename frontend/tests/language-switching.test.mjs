import { test } from 'node:test';
import assert from 'node:assert/strict';
const privateMessage = {id:1,groupId:42,senderId:7,type:'MESSAGE',content:'You have a new message'};
test('App language switching is immediate, persists across views and remounts, and sets document direction', async () => {
  const [{ default: React }, { default: Renderer, act }, { build }, { createRequire }, { fileURLToPath, pathToFileURL }] = await Promise.all([
    import('react'), import('react-test-renderer'), import('esbuild'), import('node:module'), import('node:url')
  ]);
  const require = createRequire(import.meta.url);
  const code = await build({ stdin: { contents: "import './src/main.jsx';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', define: { 'import.meta.env.VITE_API_BASE_URL': "''" }, loader: { '.css': 'empty' }, plugins: [{ name: 'app-fixture', setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true }));
    b.onResolve({ filter: /^(react-dom\/client|qrcode|react-leaflet)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'qrcode' ? 'export default {toDataURL:async()=>"data:image/png;base64,test"};' : args.path === 'react-leaflet' ? 'export const MapContainer=()=>null,TileLayer=()=>null,CircleMarker=()=>null,Popup=()=>null,Tooltip=()=>null,Polyline=()=>null,useMap=()=>({}),useMapEvents=()=>({});' : 'export function createRoot(){return {render:element=>{globalThis.__dalLanguageApp=element;}};}' }));
  } }] });
  const keys = ['window', 'document', 'navigator', 'history', 'location', 'localStorage', 'fetch', '__dalLanguageApp'];
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const window = Object.assign(new EventTarget(), { scrollTo() {}, screen: { orientation: { angle: 0 } } });
  const document = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible', documentElement: {}, getElementById: () => ({}) });
  const entries = [{}]; let index = 0;
  const pop = () => window.dispatchEvent(Object.assign(new Event('popstate'), { state: entries[index] }));
  const history = { get state() { return entries[index]; }, replaceState(state) { entries[index] = state; }, pushState(state) { entries.splice(++index, entries.length, state); }, back() { index--; pop(); }, forward() { index++; pop(); } };
  let read = false, lists = 0, groupLoads = 0, releaseList, tree;
  const notification = { ...privateMessage, senderName: 'Referenced member', createdAt: '2026-10-14T09:00:00Z' };
  const storage = new Map();
  const globals = { window, document, history, location: new URL('http://localhost/'), navigator: { onLine: true }, localStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { storage.set(key, value); } }, fetch: async url => {
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
    act(() => { tree = Renderer.create(globalThis.__dalLanguageApp); }); await flush();
    const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');

    const switchTo = language => act(() => tree.root.findAllByType('button').find(button => text(button) === language.toUpperCase()).props.onClick());
    const bottom = () => text(tree.root.findByProps({className:'bottom-nav'}));
    for (const [lang, dir, labels, stop] of [['en','ltr',['Home','Groups','Map','Chats','My account'],'Stop sharing my location everywhere'],['fr','ltr',['Accueil','Groupes','Carte','Messages','Mon compte'],'Arrêter le partage de ma position partout'],['ar','rtl',['الرئيسية','المجموعات','الخريطة','المحادثات','حسابي'],'إيقاف موقعي في الكل']]) {
      switchTo(lang); await flush(); assert.equal(document.documentElement.lang,lang);assert.equal(document.documentElement.dir,dir);assert.equal(storage.get('dal-language'),lang);
      for(const label of labels) assert.ok(bottom().includes(label),label);
      assert.equal(text(tree.root.findByProps({className:'home-sharing'})).trim(),stop);
      act(() => tree.root.findByProps({className:'bottom-nav'}).findAllByType('button')[1].props.onClick());await flush();
      assert.equal(tree.root.findByProps({className:'workspace '}).props.lang,lang);assert.equal(tree.root.findByProps({className:'workspace '}).props.dir,dir);
      assert.ok(bottom().includes(labels[1]));
      act(() => tree.root.findByProps({className:'bottom-nav'}).findAllByType('button')[0].props.onClick());await flush();
    }
    switchTo('fr');await flush();act(()=>tree.unmount());act(()=>{tree=Renderer.create(globalThis.__dalLanguageApp);});await flush();assert.equal(document.documentElement.lang,'fr');assert.ok(bottom().includes('Accueil'));
  } finally {
    releaseList?.(); if (tree) act(() => tree.unmount());
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
