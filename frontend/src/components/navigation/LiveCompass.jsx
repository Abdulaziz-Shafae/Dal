import { useLanguage } from '../../LanguageContext.jsx';
import React from 'react';
import { bearingBetween, distanceBetween, locationAge, locationLabel, normalizeAngle } from '../../utils/navigationCalculations.js';
export default function LiveCompass({ own, target, online, now, onNudge, onArrived, busy, sensor, onNearest, nearestFeedback, onMeeting, meetingFeedback }) {
  const { tr, lang, direction } = useLanguage();
  const distance = distanceBetween(own, target), bearing = bearingBetween(own, target);
  const angle = bearing === null ? null : normalizeAngle(bearing - (sensor.heading ?? 0));
  const stale = !online || (target?.userId && locationAge(target, now) > 30000) || locationAge(own, now) > 30000;
  const lowAccuracy = (own?.accuracy || 0) > 50 || (target?.accuracy || 0) > 50;
  return <div className={`dal-live-compass${sensor.heading !== null ? ' has-heading' : ''}`}>
    <p>{tr("متجه إلى")}</p><h2>{target?.name || tr("اختر عضوًا أو نقطة اللقاء")}</h2>
    {onNearest && <button className="filled nearest-member" onClick={onNearest}>{tr("وجّهني لأقرب عضو")}</button>}
    {onMeeting && <button className="outline nearest-member" onClick={onMeeting}>{tr("وجّهني إلى نقطة الالتقاء")}</button>}
    {meetingFeedback && <p className="nearest-member-feedback" role="status">{tr(meetingFeedback)}</p>}
    {nearestFeedback && <p className="nearest-member-feedback" role="status">{nearestFeedback.message ? tr(nearestFeedback.message) : tr("تم اختيار {0}. المسافة المباشرة الحالية نحو {1} م، وليست مسافة طريق مشي.", target?.name, distance === null ? '—' : Math.round(distance))}{!nearestFeedback.message && lowAccuracy ? ` ${tr("دقة الموقع منخفضة؛ المسافة والاتجاه تقريبيان.")}` : ''}</p>}
    {(!sensor.enabled || ['denied', 'unavailable'].includes(sensor.status)) && <button className="outline compass-permission" disabled={sensor.status === 'requesting'} onClick={sensor.enable}>{tr("إعادة تفعيل حساس البوصلة")}</button>}
    {sensor.heading === null && <p className="compass-sensor-status" role="status">{sensor.status === 'denied' ? tr("إذن الحساس مرفوض. ") : sensor.status === 'waiting' ? tr("بانتظار قراءة الحساس. ") : ''}{tr("الاتجاه المعروض بالنسبة للشمال؛ السهم لا يتبع دوران جوالك.")}</p>}
    <div className="dal-compass-dial" aria-label={angle === null ? tr("الاتجاه غير متاح") : tr("الاتجاه {0} درجة من الشمال", Math.round(bearing))}>
      <svg className="dal-compass-graduations" viewBox="0 0 300 300" aria-hidden="true" style={{ transform: `rotate(${-(sensor.heading ?? 0)}deg)` }}>{Array.from({length:72},(_,i)=><line key={i} x1="150" y1="9" x2="150" y2={i%6===0?'20':'15'} transform={`rotate(${i*5} 150 150)`}/>)}</svg>
      <div className="dal-cardinals" style={{ transform: `rotate(${-(sensor.heading ?? 0)}deg)` }}><span className="north">{tr("ش")}</span><span className="east">{tr("ق")}</span><span className="south">{tr("ج")}</span><span className="west">{tr("غ")}</span></div>
      {angle !== null ? <div className="dal-direction-arrow" style={{ transform: `rotate(${angle}deg)` }}><svg viewBox="0 0 120 160" aria-hidden="true"><path d="M60 10 105 140 60 112 15 140Z" fill="white"/><circle cx="60" cy="112" r="12" fill="#2bba95"/><circle cx="60" cy="112" r="5" fill="#004432"/></svg></div> : <span className="dal-no-direction">—</span>}
    </div>
    <div className="distance-placeholder">{distance === null ? '—' : Math.round(distance)} <small>{tr("م")}</small></div>
    <p>{distance === null ? tr("الموقع غير متاح. فعّل موقعك واختر وجهة لها موقع مسموح.") : lowAccuracy ? tr("دقة الموقع منخفضة؛ المسافة والاتجاه تقريبيان.") : distance < 10 ? tr("وصلت؟ اضغط لتأكيد اللقاء") : distance < 30 ? tr("قريب منك") : tr("اتجه نحو العضو أو نقطة اللقاء")}</p>
    {bearing !== null && <p>{Math.round(bearing)}{tr("° من الشمال · اتجاه مباشر، وليس مسار مشي")}</p>}
    {target && <p>{target.userId ? locationLabel(target, Date.now(), lang) : tr("نقطة لقاء ثابتة")}{target.userId && stale ? tr(" · آخر موقع معروف، قد تكون الوجهة تحركت") : ''}</p>}
    {target && !target.userId && stale && <p role="status">{tr("انتظر قراءة GPS حديثة، ثم حاول مجددًا. لم تتغير وجهتك.")}</p>}
    <p className="field-help">{tr("امسك الجوال مستويًا وبعيدًا عن المعادن. تأكيد اللقاء يدويًا بسبب حدود دقة GPS.")}</p>
    {target?.userId && <div className="pair"><button className="filled" disabled={busy || !online} onClick={onNudge}>{tr("نبّه")} {target.name}</button><button className="outline" disabled={busy || !online || distance === null} onClick={onArrived}>{tr("وصلت")}</button></div>}
    {target && !target.userId && <p>{tr("عند نقطة اللقاء، تأكد بصريًا من وصول مجموعتك.")}</p>}
  </div>;
}
