import { useLanguage } from '../../LanguageContext.jsx';
import React, { useState } from 'react';
import { api } from '../../api.js';
import { validCoordinates } from '../../utils/navigationCalculations.js';

export default function MeetingSuggestions({ groupId, locations, online, busy, save, onError }) {
  const { tr } = useLanguage();
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const points = (locations || []).filter(point => point.sharingEnabled === true && validCoordinates(point));
  async function locateMeeting() {
    if (!points.length || working || busy) return;
    setWorking(true); setResult(null);
    try {
      const latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
      const longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
      const candidates = [{ name: tr("وسط المجموعة"), latitude, longitude }];
      if (points.length > 1) {
        const minLat = Math.min(...points.map(point => point.latitude)), maxLat = Math.max(...points.map(point => point.latitude));
        const minLng = Math.min(...points.map(point => point.longitude)), maxLng = Math.max(...points.map(point => point.longitude));
        candidates.push({ name: tr("منتصف نطاق المجموعة"), latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 });
      }
      const answer = await api.meetingSuggestions(groupId, { candidates });
      setResult(answer);
    } catch (error) { onError(error); }
    finally { setWorking(false); }
  }
  const chosen = result?.ranking?.[0];
  return <section className="nav-assistant"><h2>{tr("نقطة اللقاء الذكية")}</h2><p>{tr("دال يحسب نقطة مناسبة بناءً على مواقع أعضاء مجموعتك الذين يشاركون مواقعهم، بدون ما تحتاج تقترح نقاط بنفسك.")}</p>
    <button className="filled" type="button" disabled={!online || busy || working || !points.length} onClick={locateMeeting}>{working ? tr("جارٍ تحديد نقطة اللقاء…") : tr("حدد نقطة لقاء ذكية")}</button>
    {!points.length && <p className="field-help">{tr("يلزم توفر موقع مشترك واحد على الأقل لتحديد نقطة اللقاء.")}</p>}
    {result && <div className="ai-result" role="status">{chosen ? <><b>{tr("نقطة اللقاء المحددة")}: {chosen.name}</b><p>{tr("أكبر مسافة مباشرة:")} {Math.round(chosen.maximumDistanceMeters)} {tr("م")}</p><p>{tr("هذا اختيار حسابي يعتمد على مواقع الأعضاء؛ يُستخدم AI للشرح عند توفره.")}</p>{result.warning && <p className="field-help">{tr(result.warning)}</p>}<button type="button" className="filled" disabled={busy || working || !online} onClick={async () => { if (await save({ name: chosen.name, latitude: chosen.latitude, longitude: chosen.longitude })) setResult(null); }}>{tr("اعتماد نقطة اللقاء")}</button></> : <p>{tr(result.reason || "تعذر تحديد نقطة مناسبة")}</p>}</div>}
  </section>;
}
