import React from 'react';
import useDeviceOrientation from '../../hooks/useDeviceOrientation.js';
import { bearingBetween, distanceBetween, locationAge, locationLabel, normalizeAngle } from '../../utils/navigationCalculations.js';
export default function LiveCompass({ own, target, online, now, onNudge, onArrived, busy }) {
  const sensor = useDeviceOrientation();
  const distance = distanceBetween(own, target), bearing = bearingBetween(own, target);
  const angle = bearing === null ? null : normalizeAngle(bearing - (sensor.heading ?? 0));
  const stale = !online || locationAge(target, now) > 30000 || locationAge(own, now) > 30000;
  const lowAccuracy = (own?.accuracy || 0) > 50 || (target?.accuracy || 0) > 50;
  return <div className={`dal-live-compass${sensor.heading !== null ? ' has-heading' : ''}`}>
    <p>متجه إلى</p><h2>{target?.name || 'اختر عضوًا أو نقطة اللقاء'}</h2>
    <button className="outline compass-permission" onClick={sensor.enable}>السماح بحساس البوصلة</button>
    {sensor.heading === null && <p className="compass-sensor-status" role="status">{sensor.status === 'denied' ? 'إذن الحساس مرفوض. ' : sensor.status === 'waiting' ? 'بانتظار قراءة الحساس. ' : ''}الاتجاه المعروض بالنسبة للشمال؛ السهم لا يتبع دوران جوالك.</p>}
    <div className="dal-compass-dial" aria-label={angle === null ? 'الاتجاه غير متاح' : `الاتجاه ${Math.round(bearing)} درجة من الشمال`}>
      <svg className="dal-compass-graduations" viewBox="0 0 300 300" aria-hidden="true" style={{ transform: `rotate(${-(sensor.heading ?? 0)}deg)` }}>{Array.from({length:72},(_,i)=><line key={i} x1="150" y1="9" x2="150" y2={i%6===0?'20':'15'} transform={`rotate(${i*5} 150 150)`}/>)}</svg>
      <div className="dal-cardinals" style={{ transform: `rotate(${-(sensor.heading ?? 0)}deg)` }}><span className="north">ش</span><span className="east">ق</span><span className="south">ج</span><span className="west">غ</span></div>
      {angle !== null ? <div className="dal-direction-arrow" style={{ transform: `rotate(${angle}deg)` }}><svg viewBox="0 0 120 160" aria-hidden="true"><path d="M60 10 105 140 60 112 15 140Z" fill="white"/><circle cx="60" cy="112" r="12" fill="#2bba95"/><circle cx="60" cy="112" r="5" fill="#004432"/></svg></div> : <span className="dal-no-direction">—</span>}
    </div>
    <div className="distance-placeholder">{distance === null ? '—' : Math.round(distance)} <small>م</small></div>
    <p>{distance === null ? 'الموقع غير متاح. فعّل موقعك واختر وجهة لها موقع مسموح.' : lowAccuracy ? 'دقة الموقع منخفضة؛ المسافة والاتجاه تقريبيان.' : distance < 10 ? 'وصلت؟ اضغط لتأكيد اللقاء' : distance < 30 ? 'قريب منك' : 'اتجه نحو العضو أو نقطة اللقاء'}</p>
    {bearing !== null && <p>{Math.round(bearing)}° من الشمال · اتجاه مباشر، وليس مسار مشي</p>}
    {target && <p>{locationLabel(target)}{stale ? ' · آخر موقع معروف، قد تكون الوجهة تحركت' : ''}</p>}
    <p className="field-help">امسك الجوال مستويًا وبعيدًا عن المعادن. تأكيد اللقاء يدويًا بسبب حدود دقة GPS.</p>
    {target?.userId && <div className="pair"><button className="filled" disabled={busy || !online} onClick={onNudge}>نبّه {target.name}</button><button className="outline" disabled={busy || !online || distance === null} onClick={onArrived}>وصلت</button></div>}
    {target && !target.userId && <p>عند نقطة اللقاء، تأكد بصريًا من وصول مجموعتك.</p>}
  </div>;
}
