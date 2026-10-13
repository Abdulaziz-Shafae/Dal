import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

export default function ReunionAssistant({ groupId, target, online, onError, onMeeting, onNudge }) {
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
  return <div className="nav-assistant"><button className="outline" disabled={busy || !online || !target} onClick={help}>{busy ? 'جارٍ تقييم البيانات…' : 'ساعدني أوصل'}</button>
    <p className="field-help">يرسل المساعد مسافات وأعمار تحديث ودقة فقط إلى OpenAI؛ لا يرسل الأسماء أو الإحداثيات.</p>
    {result && <div role="status"><b>{result.source === 'OPENAI' ? 'شرح من AI للبيانات المحسوبة' : 'نصيحة حسابية · خدمة AI غير متاحة'}</b><p>الموقع: {({ RECENT: 'حديث', STALE: 'قديم', UNAVAILABLE: 'غير متاح' })[result.locationStatus]}</p><p>{result.recommendation}</p><p>{result.reason}</p>{result.walkingDistanceMeters != null && <p>مسافة طريق المشي المحسوب: {Math.round(result.walkingDistanceMeters)} م</p>}<p>{result.warning}</p>{result.action === 'CONTACT_MEMBER' && target?.userId && <button className="outline" onClick={onNudge}>نبّه العضو</button>}<button className="outline" onClick={onMeeting}>عرض نقطة اللقاء</button></div>}
  </div>;
}
