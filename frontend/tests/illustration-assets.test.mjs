import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { illustrationAsset } from '../src/utils/illustrationAssets.js';

for (const name of ['hero-phone', 'map-art', 'meeting-art']) {
  test(`${name}: AR preserves the PNG; EN/FR select their localized SVGs`, async () => {
    const original = await readFile(new URL(`../public/assets/${name}.png`, import.meta.url));
    for (const lang of ['ar', 'en', 'fr']) {
      const path = illustrationAsset(name, lang);
      assert.equal(path, `/assets/${name}${lang === 'ar' ? '.png' : `-${lang}.svg`}`);
      const asset = await readFile(new URL('../public' + path, import.meta.url));
      if (lang === 'ar') { assert.deepEqual(asset, original); continue; }
      const svg = asset.toString('utf8');
      const [width, height] = [original.readUInt32BE(16), original.readUInt32BE(20)];
      assert.ok(svg.includes(`viewBox="0 0 ${width} ${height}"`));
      assert.ok(svg.includes(`lang="${lang}"`));
      assert.ok(svg.includes(`data:image/png;base64,${original.toString('base64')}`));
      assert.ok(svg.includes('data:font/woff2;base64,'));
      const labels = [...svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map(match => match[1]);
      assert.ok(labels.length >= 4);
      assert.ok(labels.every(label => !/[\u0600-\u06ff]/.test(label)), 'Untranslated illustration label');
      assert.ok(labels.includes('Expo 2030'));
      assert.ok(labels.includes(lang === 'fr' ? 'Entrée 1' : 'Entrance 1'));
      assert.ok(!/href="https?:/.test(svg), 'SVG must not depend on remote assets');
    }
  });
}
test('asset selection uses the existing language fallback and rejects unknown illustrations', () => {
  for (const language of [null, undefined, 'invalid', 'EN']) assert.equal(illustrationAsset('hero-phone', language), '/assets/hero-phone.png');
  assert.throws(() => illustrationAsset('unknown', 'en'), TypeError);
});
test('Home uses shared language-based selection for all three illustrations', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  for (const name of ['hero-phone', 'map-art', 'meeting-art']) {
    assert.ok(source.includes(`src={illustrationAsset('${name}', lang)}`));
    assert.ok(!source.includes(`src="/assets/${name}.png"`));
  }
});
