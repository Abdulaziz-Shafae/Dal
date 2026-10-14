import { useLanguage } from '../../LanguageContext.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { validCoordinates } from '../../utils/navigationCalculations.js';

export default function MeetingSuggestions({ groupId, draft, candidates, setCandidates, suggestion, setSuggestion, online, busy, save, onError }) {
  const { tr } = useLanguage();
  const [name, setName] = useState(''), [working, setWorking] = useState(false);
  const version = useRef(0);
  useEffect(() => { version.current++; setSuggestion(null); }, [candidates]);
  useEffect(() => () => { version.current++; }, []);
  async function suggest() {
    const request = ++version.current; setWorking(true);
    try { const value = await api.meetingSuggestions(groupId, { candidates }); if (request === version.current) setSuggestion(value); }
    catch (error) { if (request === version.current) onError(error); }
    finally { if (request === version.current) setWorking(false); }
  }
  const best = suggestion?.ranking?.[0];
  return <section className="nav-assistant"><h2>{tr("نقطة اللقاء الذكية")}</h2><p>{tr("حدد على الخريطة حتى ثلاث نقاط تعرف صلاحيتها، وسمّ كل نقطة قبل إضافتها.")}</p>
    <label>{tr("اسم المرشح")}<input maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
    <button className="outline" disabled={!validCoordinates(draft) || !name.trim() || candidates.length >= 3 || working} onClick={() => { setCandidates([...candidates, { ...draft, name: name.trim() }]); setName(''); }}>{tr("إضافة النقطة المختارة كمرشح")}</button>
    {candidates.map((c, i) => <div key={i}>{c.name} <button className="text-link" disabled={working} onClick={() => setCandidates(candidates.filter((_, index) => index !== i))}>{tr("إزالة المرشح")}</button></div>)}
    <button className="filled" disabled={!online || !candidates.length || working} onClick={suggest}>{working ? tr("جارٍ المقارنة…") : tr("اقترح نقطة لقاء بالذكاء الاصطناعي")}</button>
    {suggestion && <div role="status" className="ai-result"><b>{best ? tr("أفضل نقطة: {0}", best.name) : tr("لا توجد نقطة مقترحة")}</b>{best ? <p>{tr("أكبر مسافة مباشرة:")} {Math.round(best.maximumDistanceMeters)} {tr("م")}</p> : <p dir="auto">{tr(suggestion.reason)}</p>}{suggestion.warning && <p className="ai-warning">{tr(suggestion.warning)}</p>}<details className="ai-details" key={tr(suggestion.reason)}><summary>{tr("عرض التفاصيل")}</summary><p>{suggestion.source === 'OPENAI' ? tr("شرح من AI للترتيب الحسابي") : tr("تقييم حسابي غير مولّد بواسطة AI")}</p>{best && <p dir="auto">{tr(suggestion.reason)}</p>}<p>{tr("مواقع صالحة:")} {suggestion.includedMembers} {tr("· مستبعدة:")} {suggestion.excludedMembers}</p>{suggestion.ranking.map(c => <p key={c.index}>{c.name}{tr(": أكبر مسافة مباشرة")} {Math.round(c.maximumDistanceMeters)} {tr("م")}</p>)}</details>{best && <button className="filled" disabled={busy || !online || working} onClick={() => save({ name: best.name, latitude: best.latitude, longitude: best.longitude })}>{tr("اعتماد وحفظ")} {best.name}</button>}</div>}
  </section>;
}
