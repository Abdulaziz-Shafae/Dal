import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { orientationFeedback, orientationSupported } from '../src/utils/navigationPermissions.js';
import { translate, translateError } from '../src/i18n.js';
const require = createRequire(import.meta.url);
const code = await build({ stdin: { contents: "export {default as Compass} from './src/components/navigation/LiveCompass.jsx'; export {LanguageProvider} from './src/LanguageContext.jsx';", resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', plugins: [{ name: 'react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })); } }] });
const { Compass, LanguageProvider } = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
let tree;
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const point = { latitude: 24.7, longitude: 46.6, recordedAt: new Date().toISOString(), accuracy: 5 };
function render(sensor, lang = 'en', own = point) {
  return React.createElement(LanguageProvider, { lang }, React.createElement(Compass, { sensor, own, target: { ...point, userId: 2, latitude: 24.701, name: 'QA Member' }, online: true, now: Date.now(), onNudge() {}, onArrived() {} }));
}
test('API capability follows browser support, never desktop/mobile assumptions', () => {
  globalThis.window = { isSecureContext: true, DeviceOrientationEvent: class {} };
  assert.equal(orientationSupported(), true);
  window.DeviceOrientationEvent = undefined; assert.equal(orientationSupported(), false);
  window.DeviceOrientationEvent = class {}; window.isSecureContext = false; assert.equal(orientationSupported(), false);
});
for (const lang of ['ar', 'en', 'fr']) test(`compass feedback distinguishes capability, denied, pending and missing readings in ${lang}`, () => {
  let calls = 0;
  const sensor = { supported: false, heading: null, status: 'idle', enabled: false, enable: () => calls++ };
  act(() => { tree = Renderer.create(render(sensor, lang)); });
  assert.equal(tree.root.findAllByType('button').length, 2); // Existing nudge/arrival only.
  assert.ok(text(tree.toJSON()).includes(translate(orientationFeedback(sensor).message, lang)));
  const arrow = tree.root.findByProps({ className: 'dal-direction-arrow' }).props.style.transform;
  for (const status of ['denied', 'requesting', 'waiting', 'unavailable']) {
    const state = { ...sensor, supported: true, status };
    act(() => tree.update(render(state, lang)));
    const button = tree.root.findByProps({ className: 'outline compass-permission' });
    assert.equal(button.props.disabled, ['requesting', 'waiting'].includes(status));
    assert.ok(text(tree.toJSON()).includes(translate(orientationFeedback(state).message, lang)));
    assert.equal(tree.root.findByProps({ className: 'dal-direction-arrow' }).props.style.transform, arrow);
  }
  assert.equal(calls, 0); // Rendering/status changes never request native permission.
  act(() => tree.update(render({ ...sensor, supported: true, enabled: true, status: 'ready', heading: 90 }, lang)));
  assert.equal(tree.root.findAllByProps({ className: 'compass-sensor-status' }).length, 0);
  assert.equal(tree.root.findAllByProps({ className: 'outline compass-permission' }).length, 0);
  assert.notEqual(tree.root.findByProps({ className: 'dal-direction-arrow' }).props.style.transform, arrow);
});
test('a valid heading does not claim GPS is available; missing sensor does not remove GPS distance', () => {
  act(() => { tree = Renderer.create(render({ supported: true, enabled: true, heading: 0, status: 'ready' }, 'en', null)); });
  assert.equal(tree.root.findAllByProps({ className: 'dal-direction-arrow' }).length, 0);
  assert.ok(text(tree.toJSON()).includes('Location unavailable'));
  act(() => tree.update(render({ supported: false, enabled: false, heading: null, status: 'idle' })));
  assert.equal(tree.root.findAllByProps({ className: 'dal-direction-arrow' }).length, 1);
  assert.ok(text(tree.root.findByProps({ className: 'distance-placeholder' })).includes('111'));
});
test('unknown API failures never expose technical or sensitive details in any language', () => {
  for (const lang of ['ar', 'en', 'fr']) for (const raw of ['TypeError: database stack trace', '<html>502 gateway</html>', 'Authorization: synthetic-secret', 'Synthetic service failure']) {
    assert.equal(translateError(raw, lang), translate('تعذر إكمال الطلب', lang));
  }
  assert.equal(translateError('انتهت الجلسة. سجّل دخولك من جديد.', 'fr'), translate('انتهت الجلسة. سجّل دخولك من جديد.', 'fr'));
});
