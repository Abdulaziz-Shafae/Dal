import React from 'react';
export default function ConnectionStatus({ state }) {
  return <div className={'nav-connection ' + state} role="status">{state === 'connected' ? 'متصل بالخدمة · المواقع تعرض وقت آخر قراءة' : state === 'loading' ? 'جارٍ تحميل مواقع المجموعة…' : state === 'offline' ? 'الاتصال ضعيف أو منقطع · هذه آخر معلومات وصلت، وليست تتبعًا مباشرًا' : 'تعذر الوصول للمجموعة. تحقق من عضويتك وأعد فتحها.'}</div>;
}
