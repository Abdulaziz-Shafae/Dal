import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { messages, texts, faqs } from '../src/translations.js';
import { translate, translateError, languageDirection, normalizeLanguage } from '../src/i18n.js';
import { locationLabel } from '../src/utils/navigationCalculations.js';
const { parse } = createRequire(import.meta.url)('@babel/parser');
const placeholders = text => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();

test('every application message and landing key has AR, EN and FR with matching interpolation', () => {
  assert.ok(Object.keys(messages).length > 350);
  for (const [key, translations] of Object.entries(messages)) {
    for (const lang of ['ar', 'en', 'fr']) {
      const value = lang === 'ar' ? key : translations[lang];
      assert.ok(typeof value === 'string' && value.trim(), `${lang}: ${key}`);
      assert.deepEqual(placeholders(value), placeholders(key), `${lang}: ${key}`);
    }
  }
  for (const lang of ['ar', 'en', 'fr']) {
    assert.deepEqual(Object.keys(texts[lang]).sort(), Object.keys(texts.ar).sort());
    assert.ok(Object.values(texts[lang]).every(value => value.trim()));
    assert.equal(faqs[lang].length, faqs.ar.length);
    assert.ok(faqs[lang].every(pair => pair.length === 2 && pair.every(value => value.trim())));
  }
});
test('source coverage: React copy uses the shared translator and all literal keys exist', async () => {
  async function files(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(new URL(entry.name + '/', directory)) : [new URL(entry.name, directory)]))).flat();
  }
  const branding = new Set(['دال', 'دال DAL', 'العربية']);
  const inspect = (node, file) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee.name === 'tr' && node.arguments[0]?.type === 'StringLiteral') assert.ok(messages[node.arguments[0].value], `${file}: missing ${node.arguments[0].value}`);
    if (node.type === 'JSXText' && /[\u0600-\u06ff]/.test(node.value)) assert.ok(branding.has(node.value.trim()), `${file}: hardcoded JSX text: ${node.value}`);
    if (node.type === 'JSXAttribute' && node.value?.type === 'StringLiteral' && /[\u0600-\u06ff]/.test(node.value.value)) assert.ok(branding.has(node.value.value), `${file}: hardcoded attribute: ${node.value.value}`);
    for (const [key, value] of Object.entries(node)) if (!['loc', 'extra'].includes(key)) {
      if (Array.isArray(value)) value.forEach(child => inspect(child, file));
      else if (value && typeof value === 'object') inspect(value, file);
    }
  };
  for (const file of await files(new URL('../src/', import.meta.url))) if (file.pathname.endsWith('.jsx')) inspect(parse(await readFile(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }), file.pathname);
});
test('system messages change language without changing interpolated names or authored content', () => {
  const name = 'عبدالعزيز';
  assert.equal(translate('إزالة {0} من المجموعة؟', 'fr', name), `Retirer ${name} du groupe ?`);
  assert.equal(translate(`Remove ${name} from the group?`, 'ar'), `إزالة ${name} من المجموعة؟`);
  assert.equal(translate('My own message بالعربية', 'fr'), 'My own message بالعربية');
  assert.equal(translateError('أضف 8 أحرف على الأقل، أضف رمزًا واحدًا على الأقل', 'en'), 'Use at least 8 characters, Add at least one symbol');
  assert.equal(translateError('unknown internal error', 'fr'), 'Impossible de terminer la demande');
  assert.equal(translate('استغرق حساب طريق المشي وقتًا أطول من المتاح. حاول لاحقًا.', 'en'), 'Calculating the walking route took too long. Try later.');
});
test('location age and RTL/LTR are localized; unsupported languages fall back safely', () => {
  assert.equal(languageDirection('ar'), 'rtl'); assert.equal(languageDirection('en'), 'ltr'); assert.equal(languageDirection('fr'), 'ltr');
  assert.equal(normalizeLanguage('invalid'), 'ar');
  const now = Date.parse('2026-10-14T10:00:00Z');
  assert.equal(locationLabel({ recordedAt: '2026-10-14T09:58:00Z' }, now, 'fr'), 'Mise à jour il y a 2 minutes');
  assert.equal(locationLabel({ recordedAt: '2026-10-14T09:59:30Z' }, now, 'en'), 'Updated less than a minute ago');
});
