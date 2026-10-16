import { useLanguage } from '../../LanguageContext.jsx';
import React from 'react';
import { bearingBetween, distanceBetween, locationAge, locationLabel, locationStatus, normalizeAngle } from '../../utils/navigationCalculations.js';
import { orientationFeedback, orientationSupported } from '../../utils/navigationPermissions.js';
export default function LiveCompass({ own, target, online, now, onNudge, onArrived, busy, sensor, onNearest, nearestFeedback, onMeeting, meetingFeedback, routeCompass }) {
  const { tr, lang, direction } = useLanguage();
  const directPermitted = routeCompass?.status !== 'blocked';
  const directDistance = directPermitted ? distanceBetween(own, target) : null;
  const walkingMode = routeCompass?.mode === 'walking';
  const distance = walkingMode ? routeCompass.status === 'ready' ? routeCompass.remainingMeters : null : directDistance;
  const bearing = walkingMode ? routeCompass.status === 'ready' ? routeCompass.bearing : null : directPermitted ? bearingBetween(own, target) : null;
  const routeMessages = {
    ready: 'اتبع مسار المشي', updating: 'جارٍ تحديث المسار... استمر بعد اكتمال الحساب.',
    blocked: 'لا يمكن التوجيه إلى موقع غير مسموح. اختر وجهة متاحة.',
    gps: 'انتظر موقع GPS حديثًا ومسموحًا لتوجيهك عبر الطريق.',
    stale: 'موقع العضو قديم. انتظر تحديثه قبل التوجيه عبر الطريق.',
    offline: 'التوجيه عبر الطريق متوقف دون اتصال. يمكنك اختيار الاتجاه المباشر إن توفر الموقع.',
    unavailable: 'لا يوجد مسار مشي حديث. استخدم «ابدأ التوجيه» لحسابه، أو اختر الاتجاه المباشر.',
    accuracy: 'دقة GPS لا تكفي للتوجيه عبر الطريق. انتظر قراءة أدق.',
    'off-route': 'أنت بعيد عن المسار. انتظر تحديث الطريق أو اختر الاتجاه المباشر.'
  };
  const angle = bearing === null ? null : normalizeAngle(bearing - (sensor.heading ?? 0));
  const stale = !online || (target?.userId && locationAge(target, now) > 30000) || locationAge(own, now) > 30000;
  const lowAccuracy = (own?.accuracy || 0) > 50 || (target?.accuracy || 0) > 50;
  const sensorFeedback = orientationFeedback(sensor);
  return <div className={`dal-live-compass${sensor.heading !== null ? ' has-heading' : ''}`}>
    <p>{tr("متجه إلى")}</p><h2>{target?.name || tr("اختر عضوًا أو نقطة اللقاء")}</h2>
    {routeCompass && <div className="segmented compass-modes" role="group" aria-label={tr("وضع البوصلة")} dir={direction}><button aria-pressed={walkingMode} className={walkingMode ? 'active' : ''} onClick={() => routeCompass.setMode('walking')}>{tr("عبر الطريق")}</button><button aria-pressed={!walkingMode} className={!walkingMode ? 'active' : ''} onClick={() => routeCompass.setMode('direct')}>{tr("اتجاه مباشر")}</button></div>}
    {walkingMode && <p className="compass-route-feedback" role="status">{tr(routeMessages[routeCompass.status] || routeMessages.unavailable)}</p>}
    {onNearest && <button className="filled nearest-member" onClick={onNearest}>{tr("وجّهني لأقرب عضو")}</button>}
    {onMeeting && <button className="outline nearest-member" onClick={onMeeting}>{tr("وجّهني إلى نقطة الالتقاء")}</button>}
    {meetingFeedback && <p className="nearest-member-feedback" role="status">{tr(meetingFeedback)}</p>}
    {nearestFeedback && <p className="nearest-member-feedback" role="status">{nearestFeedback.message ? tr(nearestFeedback.message) : tr("تم اختيار {0}. المسافة المباشرة الحالية نحو {1} م، وليست مسافة طريق مشي.", target?.name, directDistance === null ? '—' : Math.round(directDistance))}{!nearestFeedback.message && lowAccuracy ? ` ${tr("دقة الموقع منخفضة؛ المسافة والاتجاه تقريبيان.")}` : ''}</p>}
    {sensor.heading === null && (sensor.supported ?? orientationSupported()) && <button className="outline compass-permission" disabled={!sensorFeedback.canActivate} onClick={sensor.enable}>{tr("إعادة تفعيل حساس البوصلة")}</button>}
    {sensor.heading === null && <p className="compass-sensor-status" role="status">{tr(sensorFeedback.message)} {tr("الاتجاه المعروض بالنسبة للشمال؛ السهم لا يتبع دوران جوالك.")}</p>}
    <div className="dal-compass-dial" aria-label={angle === null ? tr("الاتجاه غير متاح") : tr("الاتجاه {0} درجة من الشمال", Math.round(bearing))}>
      <svg className="dal-compass-graduations" viewBox="0 0 300 300" aria-hidden="true" style={{ transform: `rotate(${-(sensor.heading ?? 0)}deg)` }}>{Array.from({length:72},(_,i)=><line key={i} x1="150" y1="9" x2="150" y2={i%6===0?'20':'15'} transform={`rotate(${i*5} 150 150)`}/>)}</svg>
      <div className="dal-cardinals" style={{ transform: `rotate(${-(sensor.heading ?? 0)}deg)` }}><span className="north">{tr("ش")}</span><span className="east">{tr("ق")}</span><span className="south">{tr("ج")}</span><span className="west">{tr("غ")}</span></div>
      {angle !== null ? <div className="dal-direction-arrow" style={{ transform: `rotate(${angle}deg)` }}><svg viewBox="0 0 120 160" aria-hidden="true"><path d="M60 10 105 140 60 112 15 140Z" fill="white"/><circle cx="60" cy="112" r="12" fill="#2bba95"/><circle cx="60" cy="112" r="5" fill="#004432"/></svg></div> : <span className="dal-no-direction">—</span>}
    </div>
    <div className="distance-placeholder">{walkingMode && distance !== null ? '≈ ' : ''}{distance === null ? '—' : Math.round(distance)} <small>{tr("م")}</small></div>
    {routeCompass && <p className="compass-distance-label">{tr(walkingMode ? 'مسافة مشي متبقية تقريبية على المسار المحسوب' : 'مسافة مباشرة')}</p>}
    {!walkingMode && <p>{distance === null ? tr("الموقع غير متاح. فعّل موقعك واختر وجهة لها موقع مسموح.") : lowAccuracy ? tr("دقة الموقع منخفضة؛ المسافة والاتجاه تقريبيان.") : distance < 10 ? tr("وصلت؟ اضغط لتأكيد اللقاء") : distance < 30 ? tr("قريب منك") : tr("اتجه نحو العضو أو نقطة اللقاء")}</p>}
    {walkingMode && lowAccuracy && <p>{tr("دقة الموقع منخفضة؛ المسافة والاتجاه تقريبيان.")}</p>}
    {bearing !== null && <p>{walkingMode ? tr("{0}° من الشمال · نحو النقطة التالية على الطريق", Math.round(bearing)) : <>{Math.round(bearing)}{tr("° من الشمال · اتجاه مباشر، وليس مسار مشي")}</>}</p>}
    {target && <p>{target.userId ? `${locationStatus(target, now, online, lang)} · ${locationLabel(target, now, lang)}` : tr("نقطة لقاء ثابتة")}{target.userId && stale ? tr(" · آخر موقع معروف، قد تكون الوجهة تحركت") : ''}</p>}
    {target && !target.userId && stale && <p role="status">{tr("انتظر قراءة GPS حديثة، ثم حاول مجددًا. لم تتغير وجهتك.")}</p>}
    <p className="field-help">{tr("امسك الجوال مستويًا وبعيدًا عن المعادن. تأكيد اللقاء يدويًا بسبب حدود دقة GPS.")}</p>
    {target?.userId && <div className="pair"><button className="filled" disabled={busy || !online} onClick={onNudge}>{tr("نبّه")} {target.name}</button><button className="outline" disabled={busy || !online || directDistance === null} onClick={onArrived}>{tr("وصلت")}</button></div>}
    {target && !target.userId && <p>{tr("عند نقطة اللقاء، تأكد بصريًا من وصول مجموعتك.")}</p>}
  </div>;
}
