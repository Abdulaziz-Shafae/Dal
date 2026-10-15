import { useLanguage } from '../../LanguageContext.jsx';
import React, { useEffect, useState } from 'react';
import useWalkingRoute from '../../hooks/useWalkingRoute.js';
import ReunionAssistant from './ReunionAssistant.jsx';
import MeetingSuggestions from './MeetingSuggestions.jsx';
import LiveMap from './LiveMap.jsx';
import LiveCompass from './LiveCompass.jsx';
import MeetingPointPicker from './MeetingPointPicker.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import NavigationPermissionDialog from './NavigationPermissionDialog.jsx';
import { distanceBetween, locationAge, locationLabel, locationStatus, validCoordinates } from '../../utils/navigationCalculations.js';
import { nearestGroupMember } from '../../utils/nearestGroupMember.js';
import { navigationRequirements, locationFeedback } from '../../utils/navigationPermissions.js';
export default function GroupNavigation({ view, user, group, members, navigation: nav, selected, onSelect, navigate, busy, saveMeeting, removeMeeting, nudge, arrived, sensor, onError, languageControls }) {
  const { tr, lang, direction } = useLanguage();
  const [draft, setDraft] = useState(null), [meetingSelected, setMeetingSelected] = useState(false);
  const [nearestFeedback, setNearestFeedback] = useState(null), [permissionVisit, setPermissionVisit] = useState(0);
  const [meetingFeedback, setMeetingFeedback] = useState('');
  const own = nav.consent && nav.gps.status !== 'denied' ? nav.gps.point || nav.rows.find(row => row.userId === user.id) : null;
  const target = meetingSelected ? (validCoordinates(nav.meeting) ? nav.meeting : null) : members.some(member => member.userId === selected?.userId) ? nav.rows.find(row => row.userId === selected?.userId) : null;
  const manager = ['OWNER', 'ADMIN'].includes(group.myRole) && group.status !== 'CLOSED';
  const [candidates, setCandidates] = useState([]), [suggestion, setSuggestion] = useState(null);
  const walking = useWalkingRoute({ groupId: group.id, own: nav.gps.status === 'ready' ? nav.gps.point : null, target, destinationId: meetingSelected ? 'meeting' : selected?.userId || '', authorizationKey: nav.routeAuthorizationKey, authorized: nav.routeAuthorized, online: nav.state === 'connected', consent: nav.consent, requestEnabled: nav.enabled && nav.gps.status === 'ready', revalidating: nav.state === 'loading', waitingForGps: nav.enabled && ['idle', 'loading'].includes(nav.gps.status), now: nav.now });
  const select = point => { setMeetingFeedback(''); setNearestFeedback(null); if (point.userId) { setMeetingSelected(false); onSelect(point); } else setMeetingSelected(true); walking.select(); };
  const selectNearest = () => {
    setMeetingFeedback('');
    if (navigationRequirements('compass', nav, sensor).location) {
      setNearestFeedback({ message: tr("فعّل موقعك من نافذة الصلاحيات، ثم أعد اختيار أقرب عضو. لم تتغير وجهتك.") });
      setPermissionVisit(visit => visit + 1);
      return;
    }
    // Never substitute a cached account location for the live GPS reading.
    const now = Date.now();
    if (locationAge(nav.gps.point, now) > 30000) {
      setNearestFeedback({ message: tr("انتظر قراءة GPS حديثة، ثم حاول مجددًا. لم تتغير وجهتك.") });
      return;
    }
    const nearest = nearestGroupMember({ own: nav.gps.point, rows: nav.rows, members, userId: user.id, groupId: group.id, now });
    if (!nearest) {
      setNearestFeedback({ message: tr("لا يوجد عضو آخر يشارك موقعًا حديثًا في هذه المجموعة. لم تتغير وجهتك.") });
      return;
    }
    walking.stop();
    setMeetingSelected(false);
    onSelect(nearest.member);
    setNearestFeedback({ userId: nearest.member.userId });
  };
  const selectMeeting = () => {
    if (!nav.meeting) { setMeetingFeedback(tr("لم تحدد المجموعة نقطة لقاء بعد.")); return; }
    if (!validCoordinates(nav.meeting)) { setMeetingFeedback(tr("إحداثيات نقطة اللقاء غير صالحة. لم تتغير وجهتك.")); return; }
    if (navigationRequirements('compass', nav, sensor).location) {
      setMeetingFeedback(tr("فعّل موقعك من نافذة الصلاحيات لتوجيه البوصلة إلى نقطة اللقاء. لم تتغير وجهتك."));
      setPermissionVisit(visit => visit + 1);
      return;
    }
    if (locationAge(nav.gps.point) > 30000) {
      setMeetingFeedback(tr("انتظر قراءة GPS حديثة، ثم حاول مجددًا. لم تتغير وجهتك."));
      return;
    }
    walking.stop();
    setNearestFeedback(null);
    setMeetingFeedback('');
    setMeetingSelected(true);
  };
  useEffect(() => {
    if (meetingSelected && !validCoordinates(nav.meeting)) {
      walking.stop();
      setMeetingSelected(false);
      onSelect(null);
      setMeetingFeedback(tr("نقطة اللقاء لم تعد متاحة. اختر وجهة أخرى."));
    }
  }, [meetingSelected, nav.meeting]);
  const online = nav.state === 'connected';
  const location = locationFeedback(nav);
  const canStopGps = nav.enabled && nav.gps.status === 'ready';
  return <section className={`navigation-page dal-navigation dal-navigation--${view}${nav.consent ? ' has-location-consent' : ''}`} dir={direction}>
    {['map', 'compass'].includes(view) && <NavigationPermissionDialog key={`${view}:${permissionVisit}`} view={view} navigation={nav} sensor={sensor} navigate={navigate} languageControls={languageControls}/>}
    <div className="segmented"><button className={view === 'map' ? 'active' : ''} onClick={() => navigate('map')}>{tr("الخريطة")}</button><button className={view === 'compass' ? 'active' : ''} onClick={() => navigate('compass')}>{tr("البوصلة")}</button><button className={view === 'meeting' ? 'active' : ''} onClick={() => navigate('meeting')}>{tr("نقطة اللقاء")}</button></div>
    <div className="page-heading"><h1>{view === 'compass' ? tr("دال يوجّهك") : view === 'meeting' ? tr("نقطة لقاء مجموعتك") : group.name}</h1><span>{members.length} {tr("أعضاء")}</span></div>
    <ConnectionStatus state={nav.state}/>
    {walking.blocked && !target && <p className="field-help" role="alert">{tr('انتهت صلاحية الموقع، توقف التوجيه.')}</p>}
    {meetingFeedback && view === 'map' && <p className="field-help" role="status">{meetingFeedback}</p>}
    {nav.expired && <p className="field-help" role="status">{tr("انتهت مدة مشاركة الموقع.")}</p>}
    <details className="nav-gps-controls" open={!nav.consent || nav.gps.status === 'loading' || (nav.consent && !nav.enabled) || !!nav.gps.error || !!nav.uploadError || own?.accuracy > 50}><summary>{tr("الموقع والصلاحيات")}</summary>{location.supported && <button className="filled" disabled={!canStopGps && location.disabled} onClick={canStopGps ? () => { nav.stop(); walking.stop(); } : nav.start}>{canStopGps ? tr("إيقاف GPS على هذا الجهاز") : tr(location.label)}</button>}{!location.supported && <p role="status">{tr("الموقع غير متاح. افتح دال عبر HTTPS وتأكد من دعم جهازك.")}</p>}{nav.gps.status === 'denied' && <p role="status">{tr("إذا كان الإذن محظورًا، اسمح بالموقع من إعدادات Safari أو الجهاز أولًا، ثم اضغط إعادة المحاولة. لا يستطيع دال تجاوز إذن النظام.")}</p>}<p className="field-help">{tr("الموافقة تفعّل تحديد الموقع وفق إعدادات المشاركة. اختيار وجهة يرسل إحداثيات الطريق إلى OpenRouteService عبر Backend؛ لا تُرسل أسماء الأعضاء. قد يطلب المتصفح الأذونات مجددًا.")}</p><p className="field-help">{tr("المشاركة تخضع لإعداداتك في جميع مجموعاتك. الإيقاف الدائم وإخفاء الموقع من إعدادات المشاركة. التحديث يعمل أثناء فتح الصفحة فقط.")}</p><button className="text-link" onClick={() => navigate('group')}>{tr("إعدادات مشاركة المجموعة")}</button>{nav.consent && !nav.enabled && <p>{tr("المشاركة متوقفة بإعداداتك أو بانتظار التحقق من الصلاحيات.")}</p>}{nav.gps.status === 'loading' && <p role="status">{tr("جارٍ تحديد موقعك…")}</p>}{nav.gps.error && <p role="alert">{tr(nav.gps.error)}</p>}{own?.accuracy > 50 && <p role="status">{tr("دقة GPS منخفضة: ±")}{Math.round(own.accuracy)} {tr("م.")}</p>}{nav.uploadError && <p role="alert">{tr(nav.uploadError)}</p>}</details>
    {view === 'compass' ? <LiveCompass sensor={sensor} own={own} target={target} online={online} now={nav.now} busy={busy} onMeeting={selectMeeting} meetingFeedback={meetingFeedback} onNearest={selectNearest} nearestFeedback={nearestFeedback?.message ? nearestFeedback : !meetingSelected && nearestFeedback?.userId === target?.userId ? nearestFeedback : null} onNudge={() => nudge(target)} onArrived={() => arrived(target)}/> : <LiveMap expired={nav.expired} now={nav.now} online={online} rows={nav.rows} own={own} userId={user.id} meeting={nav.meeting} selected={target} onSelect={select} picking={view === 'meeting' && manager} onPick={setDraft} draft={draft} route={walking.result} candidates={view === 'meeting' ? candidates : []} suggestion={view === 'meeting' ? suggestion?.ranking?.[0] : null}/>}
    {target && view !== 'compass' && <div className="nav-target"><b>{target.name}</b><p>{distanceBetween(own, target) === null ? tr("المسافة غير متاحة") : tr("{0} م مباشرة", Math.round(distanceBetween(own, target)))} · {locationLabel(target, Date.now(), lang)}{Number.isFinite(target.accuracy) ? tr(" · دقة ±{0} م", Math.round(target.accuracy)) : ''}</p><button className="filled" disabled={!walking.available} onClick={() => { walking.start(); navigate('map'); }}>{tr("وجّهني")}</button><button className="outline" onClick={() => navigate('compass')}>{tr("فتح البوصلة")}</button></div>}
    {target && view !== 'meeting' && <div className="walking-card"><h2>{tr("التوجيه بالمشي إلى")} {target.name}</h2>
      {walking.result?.status === 'LOADING' && <p role="status">{tr("جارٍ حساب طريق المشي…")}</p>}
      {walking.result?.status === 'READY' && <p>{Math.round(walking.result.distanceMeters)} {tr("م عبر الطريق · نحو")} {Math.max(1, Math.ceil(walking.result.durationSeconds / 60))} {tr("دقيقة مشيًا")}</p>}
      {walking.result?.status === 'READY' && <div className={`walking-route-status${walking.outdated ? ' outdated' : ''}`} role="status">
        <p>{tr(walking.updating ? 'جارٍ تحديث المسار...' : walking.outdated ? 'آخر مسار محسوب' : 'المسار محدّث')}</p>
        {walking.result.offline && <p>{tr('الاتصال منقطع. هذا آخر مسار محسوب وقد لا يعكس موقعك الحالي.')}</p>}
        {walking.result.failed && <p>{tr('تعذر تحديث المسار. يمكنك إعادة المحاولة.')}</p>}
        <small>{tr('آخر حساب للمسار: {0}', new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(walking.result.calculatedAt)))}</small>
        {walking.outdated && <p>{tr('المسافة والمدة تخصان آخر حساب، وليستا تقدير وصول مباشرًا.')}</p>}
      </div>}
      {walking.result?.status === 'UNAVAILABLE' && <p role="alert">{tr('تعذر تحديث المسار. يمكنك إعادة المحاولة.')} {tr("اتجاه مباشر، وليس طريق مشي. مسافة الطريق وزمن الوصول غير متاحين.")}</p>}
      {walking.blocked && <p role="alert">{tr('انتهت صلاحية الموقع، توقف التوجيه.')} {tr("لا يمكن عرض طريق أو اتجاه إلى موقع غير مسموح.")}</p>}
      {target.userId && locationAge(target, nav.now) > 30000 && <p role="status">{tr("المسار يقود إلى آخر موقع معروف فقط؛ قد يكون العضو تحرك.")}</p>}
      {!walking.available && <p>{tr("فعّل الملاحة وانتظر موقعك الحالي ووجهة مسموحة.")}</p>}
      <div className="pair"><button className="filled" disabled={!walking.available || !online} onClick={walking.start}>{tr("ابدأ التوجيه")}</button><button className="outline" disabled={!walking.preview} onClick={walking.stop}>{tr("إيقاف التوجيه")}</button></div>
      {walking.guiding && <p>{tr("التوجيه نشط أثناء فتح الصفحة؛ يتجدد الطريق عند حركة مؤثرة.")}</p>}
      <p className="field-help">{tr("بيانات الخرائط الخارجية قد لا تغطي ممرات إكسبو الداخلية أو الإغلاقات. زمن المشي تقديري ولا يثبت صلاحية الطريق.")}</p>
      <footer className="walking-attribution" aria-label={tr("مصادر الطريق والترخيص")}><a href="https://openrouteservice.org/" target="_blank" rel="noreferrer">© openrouteservice by HeiGIT</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© {tr("OpenStreetMap contributors")}</a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">{tr("نتائج المسار: CC BY-SA 4.0")}</a></footer>
    </div>}
    {['map', 'compass'].includes(view) && <ReunionAssistant groupId={group.id} target={target || (selected?.userId ? { userId: selected.userId, name: selected.name, sharingEnabled: false } : null)} online={online} onError={onError} onNudge={() => nudge(target || selected)} onMeeting={() => { setMeetingSelected(true); walking.select(); navigate('map'); }}/>}
    {view === 'meeting' && manager && <MeetingSuggestions groupId={group.id} draft={draft} candidates={candidates} setCandidates={setCandidates} suggestion={suggestion} setSuggestion={setSuggestion} online={online} busy={busy} save={saveMeeting} onError={onError}/>}
    {view === 'meeting' && <MeetingPointPicker meeting={nav.meeting} draft={draft} onDraft={setDraft} canManage={manager} online={online} busy={busy} save={async point => { if (await saveMeeting(point)) setDraft(null); }} remove={removeMeeting}/>}
    <div className="member-picker"><h2>{tr("وين مجموعتك؟")}</h2><div className="member-row">{members.filter(m => m.userId !== user.id).map(member => {
      const point = nav.rows.find(row => row.userId === member.userId), distance = distanceBetween(own, point);
      return <button key={member.userId} onClick={() => { setMeetingFeedback(''); setNearestFeedback(null); setMeetingSelected(false); onSelect(member); walking.select(); }} aria-pressed={!meetingSelected && selected?.userId === member.userId}><span className="avatar">{member.name?.[0]}</span><b>{member.name}</b><small>{point ? tr("{0} م مباشرة · {1}{2}", distance === null ? '—' : Math.round(distance), locationLabel(point, nav.now, lang), ` · ${locationStatus(point, nav.now, online, lang)}${!online || locationAge(point, nav.now) > 30000 ? tr(" · الموقع قديم وقد يكون العضو تحرك.") : ''}`) : tr("الموقع غير متاح أو المشاركة متوقفة")}</small></button>;
    })}</div>{members.length <= 1 && <p>{tr("لا يوجد أعضاء آخرون. شارك كود المجموعة.")}</p>}{nav.meeting && <button className="outline" onClick={() => { setMeetingSelected(true); walking.select(); navigate('map'); }}>{tr("وجّهني إلى")} {nav.meeting.name}</button>}</div>
  </section>;
}
