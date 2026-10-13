import React, { useState } from 'react';
import useWalkingRoute from '../../hooks/useWalkingRoute.js';
import ReunionAssistant from './ReunionAssistant.jsx';
import MeetingSuggestions from './MeetingSuggestions.jsx';
import LiveMap from './LiveMap.jsx';
import LiveCompass from './LiveCompass.jsx';
import MeetingPointPicker from './MeetingPointPicker.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import { distanceBetween, locationAge, locationLabel } from '../../utils/navigationCalculations.js';
export default function GroupNavigation({ view, user, group, members, navigation: nav, selected, onSelect, navigate, busy, saveMeeting, removeMeeting, nudge, arrived, sensor, onError }) {
  const [draft, setDraft] = useState(null), [meetingSelected, setMeetingSelected] = useState(false);
  const own = nav.consent && nav.gps.status !== 'denied' ? nav.gps.point || nav.rows.find(row => row.userId === user.id) : null;
  const target = meetingSelected ? nav.meeting : nav.rows.find(row => row.userId === selected?.userId);
  const manager = ['OWNER', 'ADMIN'].includes(group.myRole) && group.status !== 'CLOSED';
  const [candidates, setCandidates] = useState([]), [suggestion, setSuggestion] = useState(null);
  const walking = useWalkingRoute({ groupId: group.id, own, target, online: nav.state === 'connected', consent: nav.consent && nav.enabled, now: nav.now });
  const select = point => { if (point.userId) { setMeetingSelected(false); onSelect(point); } else setMeetingSelected(true); walking.select(); };
  const online = nav.state === 'connected';
  return <section className={`navigation-page dal-navigation dal-navigation--${view}${nav.consent ? ' has-location-consent' : ''}`} dir="rtl">
    <div className="page-heading"><h1>{view === 'compass' ? 'دال يوجّهك' : view === 'meeting' ? 'نقطة لقاء مجموعتك' : group.name}</h1><span>{members.length} أعضاء</span></div>
    <ConnectionStatus state={nav.state}/>
    <details className="nav-gps-controls" open={!nav.consent || nav.gps.status === 'loading' || (nav.consent && !nav.enabled) || !!nav.gps.error || !!nav.uploadError || own?.accuracy > 50}><summary>الموقع والصلاحيات</summary><button className="filled" disabled={!online && !nav.consent} onClick={nav.consent && nav.gps.status !== 'denied' ? () => { nav.stop(); walking.stop(); } : () => { sensor.enable(); nav.start(); }}>{nav.consent && nav.gps.status !== 'denied' ? 'إيقاف GPS على هذا الجهاز' : 'تفعيل الملاحة'}</button><p className="field-help">الموافقة تفعّل تحديد الموقع وفق إعدادات المشاركة. اختيار وجهة يرسل إحداثيات الطريق إلى OpenRouteService عبر Backend؛ لا تُرسل أسماء الأعضاء. قد يطلب المتصفح الأذونات مجددًا.</p><p className="field-help">المشاركة تخضع لإعداداتك في جميع مجموعاتك. الإيقاف الدائم وإخفاء الموقع من إعدادات المشاركة. التحديث يعمل أثناء فتح الصفحة فقط.</p><button className="text-link" onClick={() => navigate('group')}>إعدادات مشاركة المجموعة</button>{nav.consent && !nav.enabled && <p>المشاركة متوقفة بإعداداتك أو بانتظار التحقق من الصلاحيات.</p>}{nav.gps.status === 'loading' && <p role="status">جارٍ تحديد موقعك…</p>}{nav.gps.error && <p role="alert">{nav.gps.error}</p>}{own?.accuracy > 50 && <p role="status">دقة GPS منخفضة: ±{Math.round(own.accuracy)} م.</p>}{nav.uploadError && <p role="alert">{nav.uploadError}</p>}</details>
    <div className="segmented"><button className={view === 'map' ? 'active' : ''} onClick={() => navigate('map')}>الخريطة</button><button className={view === 'compass' ? 'active' : ''} onClick={() => navigate('compass')}>البوصلة</button><button className={view === 'meeting' ? 'active' : ''} onClick={() => navigate('meeting')}>نقطة اللقاء</button></div>
    {view === 'compass' ? <LiveCompass sensor={sensor} own={own} target={target} online={online} now={nav.now} busy={busy} onNudge={() => nudge(target)} onArrived={() => arrived(target)}/> : <LiveMap rows={nav.rows} own={own} userId={user.id} meeting={nav.meeting} selected={target} onSelect={select} picking={view === 'meeting' && manager} onPick={setDraft} draft={draft} route={walking.result} candidates={view === 'meeting' ? candidates : []} suggestion={view === 'meeting' ? suggestion?.ranking?.[0] : null}/>}
    {target && view !== 'compass' && <div className="nav-target"><b>{target.name}</b><p>{distanceBetween(own, target) === null ? 'المسافة غير متاحة' : `${Math.round(distanceBetween(own, target))} م مباشرة`} · {locationLabel(target)}{Number.isFinite(target.accuracy) ? ` · دقة ±${Math.round(target.accuracy)} م` : ''}</p><button className="filled" disabled={!walking.available} onClick={() => { walking.start(); navigate('map'); }}>وجّهني</button><button className="outline" onClick={() => navigate('compass')}>فتح البوصلة</button></div>}
    {target && view !== 'meeting' && <div className="walking-card"><h2>التوجيه بالمشي إلى {target.name}</h2>
      {walking.result?.status === 'LOADING' && <p role="status">جارٍ حساب طريق المشي…</p>}
      {walking.result?.status === 'READY' && <p>{Math.round(walking.result.distanceMeters)} م عبر الطريق · نحو {Math.max(1, Math.ceil(walking.result.durationSeconds / 60))} دقيقة مشيًا</p>}
      {walking.result?.status === 'UNAVAILABLE' && <p role="alert">{walking.result.message} اتجاه مباشر، وليس طريق مشي. مسافة الطريق وزمن الوصول غير متاحين.</p>}
      {walking.result?.status === 'LOCATION_UNAVAILABLE' && <p role="alert">{walking.result.message} لا يمكن عرض طريق أو اتجاه إلى موقع غير مسموح.</p>}
      {target.userId && locationAge(target, nav.now) > 30000 && <p role="status">المسار يقود إلى آخر موقع معروف فقط؛ قد يكون العضو تحرك.</p>}
      {!walking.available && <p>فعّل الملاحة وانتظر موقعك الحالي ووجهة مسموحة.</p>}
      <div className="pair"><button className="filled" disabled={!walking.available || !online} onClick={walking.start}>ابدأ التوجيه</button><button className="outline" disabled={!walking.preview} onClick={walking.stop}>إيقاف التوجيه</button></div>
      {walking.guiding && <p>التوجيه نشط أثناء فتح الصفحة؛ يتجدد الطريق عند حركة مؤثرة.</p>}
      <p className="field-help">بيانات الخرائط الخارجية قد لا تغطي ممرات إكسبو الداخلية أو الإغلاقات. زمن المشي تقديري ولا يثبت صلاحية الطريق.</p>
      <a href="https://openrouteservice.org/" target="_blank" rel="noreferrer">© openrouteservice by HeiGIT</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">نتائج المسار: CC BY-SA 4.0</a>
    </div>}
    {['map', 'compass'].includes(view) && <ReunionAssistant groupId={group.id} target={target || (selected?.userId ? { userId: selected.userId, name: selected.name, sharingEnabled: false } : null)} online={online} onError={onError} onNudge={() => nudge(target || selected)} onMeeting={() => { setMeetingSelected(true); walking.select(); navigate('map'); }}/>}
    {view === 'meeting' && manager && <MeetingSuggestions groupId={group.id} draft={draft} candidates={candidates} setCandidates={setCandidates} suggestion={suggestion} setSuggestion={setSuggestion} online={online} busy={busy} save={saveMeeting} onError={onError}/>}
    {view === 'meeting' && <MeetingPointPicker meeting={nav.meeting} draft={draft} onDraft={setDraft} canManage={manager} online={online} busy={busy} save={async point => { if (await saveMeeting(point)) setDraft(null); }} remove={removeMeeting}/>}
    <div className="member-picker"><h2>وين مجموعتك؟</h2><div className="member-row">{members.filter(m => m.userId !== user.id).map(member => {
      const point = nav.rows.find(row => row.userId === member.userId), distance = distanceBetween(own, point);
      return <button key={member.userId} onClick={() => { setMeetingSelected(false); onSelect(member); walking.select(); }} aria-pressed={!meetingSelected && selected?.userId === member.userId}><span className="avatar">{member.name?.[0]}</span><b>{member.name}</b><small>{point ? `${distance === null ? '—' : Math.round(distance)} م مباشرة · ${locationLabel(point)}${!online || locationAge(point, nav.now) > 30000 ? ' · قديم' : ''}` : 'الموقع غير متاح أو المشاركة متوقفة'}</small></button>;
    })}</div>{members.length <= 1 && <p>لا يوجد أعضاء آخرون. شارك كود المجموعة.</p>}{nav.meeting && <button className="outline" onClick={() => { setMeetingSelected(true); walking.select(); navigate('map'); }}>وجّهني إلى {nav.meeting.name}</button>}</div>
  </section>;
}
