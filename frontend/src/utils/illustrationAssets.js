import { normalizeLanguage } from '../i18n.js';

const illustrations = ['hero-phone', 'map-art', 'meeting-art'];
export function illustrationAsset(name, language) {
  if (!illustrations.includes(name)) throw new TypeError('Unknown DAL illustration');
  const lang = normalizeLanguage(language);
  return `/assets/${name}${lang === 'ar' ? '.png' : `-${lang}.svg`}`;
}
