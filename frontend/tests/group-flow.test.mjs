import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8').split('const root =')[0] + '\nexport default App;';
const code = await build({ stdin: { contents: source, loader: 'jsx', resolveDir: fileURLToPath(new URL('../src', import.meta.url)) }, bundle: true, write: false, format: 'esm', loader: { '.css': 'empty' }, plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /^(react|react-dom|react-dom\/client)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
  b.onResolve({ filter: /^(\.\/api|.*useGroupLocations\.js|.*useDeviceOrientation\.js|.*GroupNavigation\.jsx|.*GroupChat\.jsx|qrcode)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({path}) => ({ contents: path === './api' ? 'export const api = globalThis.flowApi;' : path === 'qrcode' ? 'export default {toDataURL: async()=>"qr"};' : path.includes('GroupNavigation') ? 'export default function Navigation(props) { return null; }' : path.includes('GroupChat') ? 'export default function Chat(props) { return null; }' : 'export default () => ({});' }));
} }] });
let tree;
const text = n => typeof n === 'string' ? n : (n?.children || []).map(text).join('');
const click = async node => act(async () => { await node.props.onClick(); });
const buttons = label => tree.root.findAllByType('button').filter(n => text(n) === label);
const group = { id: 1, name: 'Family', myRole: 'OWNER', joinCode: 'AB12C', status: 'ACTIVE' };
async function setup({ guest = false, pending = false, failRefresh = false, empty = false } = {}) {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.location = { search: '', pathname: '/', origin: 'https://example.test' };
  globalThis.history = { state: null, replaceState() {} };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, scrollTo() {} };
  globalThis.document = { documentElement: {}, querySelector() {}, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  let created = false;
  globalThis.flowApi = {
    profile: async () => { if (guest) throw Error('guest'); return { id: 10, name: 'Me' }; },
    login: async () => ({id:10,name:'Me'}), groups: async () => { if (created && failRefresh) throw Error('refresh failed'); return empty ? [] : [group]; }, requests: async () => [], sharing: async () => ({}), unreadNotifications: async () => ({count:0}),
    group: async () => group, members: async () => [{id:1,userId:10,name:'Me'}, {id:2,userId:20,name:'Friend'}], groupSharing: async () => ({}), meeting: async () => null, groupRequests: async () => [],
    createGroup: async () => { created = true; return group; }, join: async () => ({groupId:1,status:pending?'PENDING':'JOINED'}), conversation: async () => ({content:[],last:true})
  };
  // Each import captures this test's fixture API.
  const {default:App} = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text + `\n// ${Math.random()}`).toString('base64'));
  await act(async () => { tree = Renderer.create(React.createElement(App)); });
}
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
const submit = async values => { const old = globalThis.FormData; globalThis.FormData = class { constructor() { return Object.entries(values); } }; try { await act(async () => { await tree.root.findByType('form').props.onSubmit({preventDefault(){},currentTarget:{}}); }); } finally { globalThis.FormData = old; } };
async function choose() { await click(tree.root.findByProps({className:'group-card'})); }
test('compass chooses a group and opens its compass, even after another group was active', async () => {
  await setup(); await click(buttons('البوصلة')[0]); assert.ok(text(tree.toJSON()).includes('اختر مجموعة')); await choose();
  assert.equal(tree.root.find(n => typeof n.type === 'function' && n.props.navigation !== undefined && n.props.view !== undefined).props.view, 'compass');
  await click(tree.root.findByProps({'aria-label':'رجوع'})); await click(tree.root.findByProps({className:'brand brand-dark'}));
  await click(buttons('البوصلة')[0]); assert.ok(text(tree.toJSON()).includes('اختر مجموعة'));
});

test('creation opens group details despite a later list refresh failure', async () => {
  await setup({failRefresh:true}); await click(buttons('ابدأ مجموعتك')[0]); await submit({name:'Family',joinMode:'DIRECT'});
  assert.ok(text(tree.toJSON()).includes('تفاصيل المجموعة')); assert.ok(text(tree.toJSON()).includes('AB12C'));
});
test('plain group selection opens details and back returns to groups', async () => {
  await setup(); await click(buttons('المجموعات')[0]); await choose(); assert.ok(text(tree.toJSON()).includes('تفاصيل المجموعة'));
  await click(tree.root.findByProps({'aria-label':'رجوع'})); assert.ok(text(tree.toJSON()).includes('مجموعاتك'));
});
test('a member message shortcut opens the private conversation', async () => {
  await setup(); await click(buttons('المجموعات')[0]); await choose(); await click(tree.root.findByProps({title:'محادثة'}));
  assert.equal(buttons('المحادثات الخاصة')[0].props.className,'active'); assert.ok(text(tree.toJSON()).includes('Friend'));
});
test('guest compass intent survives login and group selection', async () => {
  await setup({guest:true}); await click(buttons('البوصلة')[0]); await submit({email:'test@example.test',password:'test'});
  assert.ok(text(tree.toJSON()).includes('اختر مجموعة')); await choose(); assert.equal(tree.root.find(n=>typeof n.type === 'function' && n.props.navigation !== undefined && n.props.view !== undefined).props.view,'compass');
});
test('approval join returns to groups without opening an unapproved group', async () => {
  await setup({pending:true}); await click(buttons('المجموعات')[0]); await click(buttons('عندي كود مجموعة')[0]); await submit({joinCode:'AB12C'});
  assert.ok(text(tree.toJSON()).includes('مجموعاتك')); assert.equal(tree.root.findAllByProps({className:'panel group-detail'}).length,0);
});

test('empty group chooser offers creation and joining', async () => {
  await setup({empty:true}); await click(buttons('البوصلة')[0]);
  assert.ok(text(tree.toJSON()).includes('ما عندك مجموعات حتى الآن')); assert.ok(buttons('ابدأ مجموعتك').length); assert.ok(buttons('عندي كود مجموعة').length);
});
test('direct join opens the group details', async () => {
  await setup(); await click(buttons('المجموعات')[0]); await click(buttons('عندي كود مجموعة')[0]); await submit({joinCode:'AB12C'});
  assert.ok(text(tree.toJSON()).includes('تفاصيل المجموعة'));
});
test('creating from a compass chooser still opens new group details', async () => {
  await setup(); await click(buttons('البوصلة')[0]); await click(buttons('مجموعة جديدة')[0]); await submit({name:'Family',joinMode:'DIRECT'});
  assert.ok(text(tree.toJSON()).includes('تفاصيل المجموعة'));
});
