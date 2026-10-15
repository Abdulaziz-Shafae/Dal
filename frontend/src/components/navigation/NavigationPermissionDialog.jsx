import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Compass } from 'lucide-react';
import Dialog from '../../Dialog.jsx';
import { useLanguage } from '../../LanguageContext.jsx';
import { navigationRequirements, orientationFeedback, orientationSupported, locationFeedback } from '../../utils/navigationPermissions.js';

// GroupNavigation keys this component by page so dismissal lasts for one visit.
export default function NavigationPermissionDialog({ view, navigation: nav, sensor, navigate, languageControls }) {
  const { tr } = useLanguage();
  const missing = navigationRequirements(view, nav, sensor);
  const [open, setOpen] = useState(() => {
    const resumingLocation = nav.consent && nav.enabled && ['idle', 'loading'].includes(nav.gps.status);
    return missing.sensor || (missing.location && !resumingLocation);
  });
  const locationAttempt = useRef(false), sensorAttempt = useRef(false);
  const location = locationFeedback(nav);
  const locationSupported = location.supported;
  const sensorSupported = sensor.supported ?? orientationSupported();
  const sensorFeedback = orientationFeedback(sensor);
  const blocked = nav.settingsReady && !nav.sharingAllowed;
  const locationLoading = location.loading;
  useEffect(() => { if (!locationLoading) locationAttempt.current = false; }, [nav.gps.status, nav.gps.attempt, locationLoading]);
  useEffect(() => { if (!['requesting', 'waiting'].includes(sensor.status)) sensorAttempt.current = false; }, [sensor.status]);
  useEffect(() => { if (!missing.location && !missing.sensor) setOpen(false); }, [missing.location, missing.sensor]);
  if (!open || (!missing.location && !missing.sensor)) return null;

  function enableLocation() {
    if (locationAttempt.current || blocked || !nav.settingsReady || nav.state !== 'connected' || !locationSupported || locationLoading) return;
    locationAttempt.current = true;
    if (nav.start() === false) locationAttempt.current = false;
  }
  function enableSensor() {
    if (sensorAttempt.current || !sensorSupported || ['requesting', 'waiting'].includes(sensor.status)) return;
    sensorAttempt.current = true;
    // Invoke directly in the trusted click; iOS requires transient user activation.
    Promise.resolve(sensor.enable()).finally(() => { sensorAttempt.current = false; });
  }
  return <Dialog className="permission-panel" labelledBy="navigation-permission-title" onClose={() => setOpen(false)}>
    <h2 id="navigation-permission-title">{tr('تفعيل الملاحة')}</h2>
    {missing.location && <section className="permission-requirement" aria-labelledby="location-permission-title">
      <h3 id="location-permission-title"><MapPin size={20}/>{tr('الموقع')}</h3>
      <p>{tr('يستخدم دال موقعك لحساب المسافات والاتجاهات ومشاركته مع أعضاء مجموعتك المسموح لهم وفق إعداداتك الحالية أثناء فتح الصفحة. التفعيل يحتاج موافقتك.')}</p>
      {blocked ? <><p role="status">{tr('مشاركة الموقع متوقفة أو خارج وقت الجدولة. راجع إعدادات حسابك ومجموعتك قبل التفعيل؛ لن نغيّرها تلقائيًا.')}</p><div className="permission-settings"><button className="text-link" onClick={() => navigate('settings')}>{tr('إعدادات الحساب')}</button><button className="text-link" onClick={() => navigate('group')}>{tr('إعدادات مشاركة المجموعة')}</button></div></> : <>
        {(!nav.settingsReady || nav.state === 'loading') && <p role="status">{tr('جارٍ التحقق من إعدادات المشاركة…')}</p>}
        {['offline', 'error'].includes(nav.state) && <p role="status">{tr('تعذر التحقق من صلاحيات المشاركة. تحقق من الاتصال وأعد فتح الصفحة.')}</p>}
        {locationLoading && <p role="status">{tr('جارٍ تحديد موقعك…')}</p>}
        {(!locationSupported || nav.gps.error) && <p role="alert">{tr(nav.gps.error || 'الموقع غير متاح. افتح دال عبر HTTPS وتأكد من دعم جهازك.')}</p>}
        {nav.gps.status === 'denied' && <p>{tr('إذا كان الإذن محظورًا، اسمح بالموقع من إعدادات Safari أو الجهاز أولًا، ثم اضغط إعادة المحاولة. لا يستطيع دال تجاوز إذن النظام.')}</p>}
      </>}
      {locationSupported && <button className="filled" disabled={location.disabled} onClick={enableLocation}>{tr(location.label)}</button>}
    </section>}
    {missing.sensor && <section className="permission-requirement" aria-labelledby="sensor-permission-title">
      <h3 id="sensor-permission-title"><Compass size={20}/>{tr('حساس البوصلة')}</h3>
      <p>{tr('يستخدم دال حساس الاتجاه لتحديث سهم البوصلة عند تدوير الجوال. تفعيل الحساس وحده لا يفعّل مشاركة الموقع.')}</p>
      <p role={sensor.status === 'denied' && sensorSupported ? 'alert' : 'status'}>{tr(sensorFeedback.message)}</p>
      <p>{tr('الاتجاه المعروض بالنسبة للشمال؛ السهم لا يتبع دوران جوالك.')}</p>
      {sensorSupported && <button className="filled" disabled={!sensorFeedback.canActivate} onClick={enableSensor}>{tr('تفعيل حساس البوصلة')}</button>}
    </section>}
    <button className="outline full" onClick={() => setOpen(false)}>{tr('ليس الآن')}</button>
    {languageControls}
  </Dialog>;
}
