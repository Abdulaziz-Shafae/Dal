import { useLanguage } from '../../LanguageContext.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

export default function ReunionAssistant({ groupId, target, online, onError, onMeeting, onNudge }) {
  const { tr } = useLanguage();
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => { version.current++; setResult(null); setBusy(false); return () => { version.current++; }; }, [groupId, target?.userId, target?.id, target?.sharingEnabled, target?.recordedAt, target?.latitude, target?.longitude]);
  async function help() {
    const request = ++version.current; setBusy(true);
    try {
      const value = await api.reunionAssistance(groupId, { memberId: target.userId || null, meetingPoint: !target.userId });
      if (request === version.current) setResult(value);
    } catch (error) { if (request === version.current) onError(error); }
    finally { if (request === version.current) setBusy(false); }
  }
  return <div className="nav-assistant"><button className="outline" disabled={busy || !online || !target} onClick={help}>{busy ? tr("جارٍ تقييم البيانات…") : tr("ساعدني أوصل")}</button>
    {result && <div role="status" className="ai-result"><b>{tr("الموقع:")} {({ RECENT: tr("حديث"), STALE: tr("قديم"), UNAVAILABLE: tr("غير متاح") })[result.locationStatus]}</b><p className="ai-recommendation">{tr(result.recommendation)}</p>{result.warning && <p className="ai-warning">{tr(result.warning)}</p>}{result.walkingDistanceMeters != null && <p>{tr("طريق المشي:")} {Math.round(result.walkingDistanceMeters)} {tr("م")}</p>}{result.action === 'CONTACT_MEMBER' && target?.userId && <button className="outline" onClick={onNudge}>{tr("نبّه العضو")}</button>}<button className="outline" onClick={onMeeting}>{tr("عرض نقطة اللقاء")}</button></div>}
    <details className="ai-details" key={result ? 'result' : 'intro'}><summary>{tr("عرض التفاصيل")}</summary>{result && <><p>{result.source === 'OPENAI' ? tr("شرح من AI للبيانات المحسوبة") : tr("نصيحة حسابية · خدمة AI غير متاحة")}</p><p dir="auto">{tr(result.reason)}</p></>}<p className="field-help">{tr("يرسل المساعد مسافات وأعمار تحديث ودقة فقط إلى OpenAI؛ لا يرسل الأسماء أو الإحداثيات.")}</p></details>
  </div>;
}
