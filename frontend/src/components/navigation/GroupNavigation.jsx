import React, { useState } from 'react';
import LiveMap from './LiveMap.jsx';
import LiveCompass from './LiveCompass.jsx';
import MeetingPointPicker from './MeetingPointPicker.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import { distanceBetween, locationAge, locationLabel } from '../../utils/navigationCalculations.js';
export default function GroupNavigation({ view, user, group, members, navigation: nav, selected, onSelect, navigate, busy, saveMeeting, removeMeeting, nudge, arrived }) {
  const [draft, setDraft] = useState(null), [meetingSelected, setMeetingSelected] = useState(false);
  const own = nav.gps.point || (nav.consent ? nav.rows.find(row => row.userId === user.id) : null);
  const target = meetingSelected ? nav.meeting : nav.rows.find(row => row.userId === selected?.userId);
  const manager = ['OWNER', 'ADMIN'].includes(group.myRole) && group.status !== 'CLOSED';
  const select = point => { if (point.userId) { setMeetingSelected(false); onSelect(point); } else setMeetingSelected(true); };
  const online = nav.state === 'connected';
  return <section className="navigation-page dal-navigation" dir="rtl">
    <div className="page-heading"><h1>{view === 'compass' ? 'دال يوجّهك' : view === 'meeting' ? 'نقطة لقاء مجموعتك' : group.name}</h1><span>{members.length} أعضاء</span></div>
    <ConnectionStatus state={nav.state}/>
    <div className="nav-gps-controls"><button className="filled" disabled={!online && !nav.consent} onClick={nav.consent ? nav.stop : nav.start}>{nav.consent ? 'إيقاف GPS على هذا الجهاز' : 'أوافق على تحديد موقعي ومشاركته وفق إعداداتي'}</button><p className="field-help">المشاركة تخضع لإعداداتك في جميع مجموعاتك. الإيقاف الدائم وإخفاء الموقع من إعدادات المشاركة. التحديث يعمل أثناء فتح الصفحة فقط.</p><button className="text-link" onClick={() => navigate('group')}>إعدادات مشاركة المجموعة</button>{nav.consent && !nav.enabled && <p>المشاركة متوقفة بإعداداتك أو بانتظار التحقق من الصلاحيات.</p>}{nav.gps.status === 'loading' && <p role="status">جارٍ تحديد موقعك…</p>}{nav.gps.error && <p role="alert">{nav.gps.error}</p>}{own?.accuracy > 50 && <p role="status">دقة GPS منخفضة: ±{Math.round(own.accuracy)} م.</p>}{nav.uploadError && <p role="alert">{nav.uploadError}</p>}</div>
    <div className="segmented"><button className={view === 'map' ? 'active' : ''} onClick={() => navigate('map')}>الخريطة</button><button className={view === 'compass' ? 'active' : ''} onClick={() => navigate('compass')}>البوصلة</button><button className={view === 'meeting' ? 'active' : ''} onClick={() => navigate('meeting')}>نقطة اللقاء</button></div>
    {view === 'compass' ? <LiveCompass own={own} target={target} online={online} now={nav.now} busy={busy} onNudge={() => nudge(target)} onArrived={() => arrived(target)}/> : <LiveMap rows={nav.rows} own={own} userId={user.id} meeting={nav.meeting} selected={target} onSelect={select} picking={view === 'meeting' && manager} onPick={setDraft} draft={draft}/>}
    {target && view !== 'compass' && <div className="nav-target"><b>{target.name}</b><p>{distanceBetween(own, target) === null ? 'المسافة غير متاحة' : `${Math.round(distanceBetween(own, target))} م`} · {locationLabel(target)}{Number.isFinite(target.accuracy) ? ` · دقة ±${Math.round(target.accuracy)} م` : ''}</p><button className="filled" onClick={() => navigate('compass')}>وجّهني</button></div>}
    {view === 'meeting' && <MeetingPointPicker meeting={nav.meeting} draft={draft} onDraft={setDraft} canManage={manager} online={online} busy={busy} save={async point => { if (await saveMeeting(point)) setDraft(null); }} remove={removeMeeting}/>}
    <div className="member-picker"><h2>وين مجموعتك؟</h2><div className="member-row">{members.filter(m => m.userId !== user.id).map(member => {
      const point = nav.rows.find(row => row.userId === member.userId), distance = distanceBetween(own, point);
      return <button key={member.userId} onClick={() => { setMeetingSelected(false); onSelect(member); }} aria-pressed={!meetingSelected && selected?.userId === member.userId}><span className="avatar">{member.name?.[0]}</span><b>{member.name}</b><small>{point ? `${distance === null ? '—' : Math.round(distance)} م · ${locationLabel(point)}${!online || locationAge(point, nav.now) > 30000 ? ' · قديم' : ''}` : 'الموقع غير متاح أو المشاركة متوقفة'}</small></button>;
    })}</div>{members.length <= 1 && <p>لا يوجد أعضاء آخرون. شارك كود المجموعة.</p>}{nav.meeting && <button className="outline" onClick={() => { setMeetingSelected(true); navigate('compass'); }}>وجّهني إلى {nav.meeting.name}</button>}</div>
  </section>;
}
