import { messages } from './translations.js';

export const supportedLanguages = ['ar', 'en', 'fr'];
export const languageDirection = lang => lang === 'ar' ? 'rtl' : 'ltr';
export const normalizeLanguage = lang => supportedLanguages.includes(lang) ? lang : 'ar';
const interpolate = (text, values) => text.replace(/\{(\d+)\}/g, (_, index) => String(values[index] ?? ''));
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = new Map();
const templates = [];
for (const [key, translations] of Object.entries(messages)) {
  for (const text of [key, translations.en, translations.fr]) {
    if (/\{\d+\}/.test(text)) {
      const indices = [];
      const parts = text.split(/(\{\d+\})/g).map(part => {
        if (/^\{\d+\}$/.test(part)) { indices.push(Number(part.slice(1, -1))); return '(.*?)'; }
        return escapeRegex(part);
      });
      templates.push({ key, indices, specificity: text.replace(/\{\d+\}/g, '').length, pattern: new RegExp('^' + parts.join('') + '$', 's') });
    } else if (!exact.has(text)) exact.set(text, key);
  }
}
// Full messages must match before shorter labels such as “Remove {0}”.
templates.sort((a, b) => b.specificity - a.specificity);
function resolve(text) {
  if (exact.has(text)) return { key: exact.get(text), values: [] };
  for (const { key, indices, pattern } of templates) {
    const match = pattern.exec(text);
    if (match) {
      const values = []; indices.forEach((index, i) => { values[index] = match[i + 1]; });
      return { key, values };
    }
  }
  return null;
}
// Only known application messages are translated. Names and authored content stay intact.
export function translate(text, lang = 'ar', ...values) {
  lang = normalizeLanguage(lang);
  if (text == null) return '';
  const message = messages[text] ? { key: text, values } : resolve(String(text));
  if (!message) return String(text);
  return interpolate(lang === 'ar' ? message.key : messages[message.key][lang], message.values);
}
export function translateError(text, lang) {
  if (resolve(String(text))) return translate(text, lang);
  const parts = String(text).split(/، |; /);
  if (parts.length > 1 && parts.every(part => resolve(part))) return parts.map(part => translate(part, lang)).join(lang === 'ar' ? '، ' : ', ');
  return translate('تعذر إكمال الطلب', lang);
}
