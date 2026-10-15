import { useLanguage } from '../../LanguageContext.jsx';
import React from 'react';
export default function ConnectionStatus({ state }) {
  const { tr } = useLanguage();
  return <div className={'nav-connection ' + state} role="status">{state === 'connected' ? tr("متصل بالخدمة · المواقع تعرض وقت آخر قراءة") : state === 'loading' ? tr("جارٍ تحميل مواقع المجموعة…") : state === 'offline' ? tr("الاتصال ضعيف أو منقطع · هذه آخر معلومات وصلت، وليست تتبعًا مباشرًا") : tr("تعذر الوصول للمجموعة. تحقق من عضويتك وأعد فتحها.")}</div>;
}
