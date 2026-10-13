import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { validCoordinates } from '../../utils/navigationCalculations.js';

export default function MeetingSuggestions({ groupId, draft, candidates, setCandidates, suggestion, setSuggestion, online, busy, save, onError }) {
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
  return <section className="nav-assistant"><h2>نقطة اللقاء الذكية</h2><p>حدد على الخريطة حتى ثلاث نقاط تعرف صلاحيتها، وسمّ كل نقطة قبل إضافتها.</p>
    <label>اسم المرشح<input maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
    <button className="outline" disabled={!validCoordinates(draft) || !name.trim() || candidates.length >= 3 || working} onClick={() => { setCandidates([...candidates, { ...draft, name: name.trim() }]); setName(''); }}>إضافة النقطة المختارة كمرشح</button>
    {candidates.map((c, i) => <div key={i}>{c.name} <button className="text-link" disabled={working} onClick={() => setCandidates(candidates.filter((_, index) => index !== i))}>إزالة المرشح</button></div>)}
    <button className="filled" disabled={!online || !candidates.length || working} onClick={suggest}>{working ? 'جارٍ المقارنة…' : 'اقترح نقطة لقاء بالذكاء الاصطناعي'}</button>
    {suggestion && <div role="status"><b>{suggestion.source === 'OPENAI' ? 'شرح من AI للترتيب الحسابي' : 'تقييم حسابي غير مولّد بواسطة AI'}</b><p>{suggestion.reason}</p><p>{suggestion.warning}</p><p>مواقع صالحة: {suggestion.includedMembers} · مستبعدة: {suggestion.excludedMembers}</p>{suggestion.ranking.map(c => <p key={c.index}>{c.name}: أكبر مسافة مباشرة {Math.round(c.maximumDistanceMeters)} م</p>)}{best && <button className="filled" disabled={busy || !online || working} onClick={() => save({ name: best.name, latitude: best.latitude, longitude: best.longitude })}>اعتماد وحفظ {best.name}</button>}</div>}
  </section>;
}
