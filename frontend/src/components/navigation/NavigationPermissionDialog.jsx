import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Compass } from 'lucide-react';
import Dialog from '../../Dialog.jsx';
import { useLanguage } from '../../LanguageContext.jsx';
import { navigationRequirements } from '../../utils/navigationPermissions.js';

// GroupNavigation keys this component by page so dismissal lasts for one visit.
export default function NavigationPermissionDialog({ view, navigation: nav, sensor, navigate, languageControls }) {
  const { tr } = useLanguage();
  const missing = navigationRequirements(view, nav, sensor);
  const [open, setOpen] = useState(() => {
    const resumingLocation = nav.consent && nav.enabled && ['idle', 'loading'].includes(nav.gps.status);
    return missing.sensor || (missing.location && !resumingLocation);
  });
  const [locationRequested, setLocationRequested] = useState(false), [sensorRequested, setSensorRequested] = useState(false);
  const locationAttempt = useRef(false), sensorAttempt = useRef(false);
  const locationSupported = !!(window.isSecureContext && navigator.geolocation);
  const sensorSupported = !!(window.isSecureContext && window.DeviceOrientationEvent);
  const blocked = nav.settingsReady && !nav.sharingAllowed;
  const locationLoading = nav.consent && (nav.gps.status === 'loading' || (locationRequested && nav.gps.status === 'idle'));
  useEffect(() => { if (!missing.location && !missing.sensor) setOpen(false); }, [missing.location, missing.sensor]);
  if (!open || (!missing.location && !missing.sensor)) return null;

  function enableLocation() {
    if (locationAttempt.current || blocked || !nav.settingsReady || nav.state !== 'connected' || !locationSupported || locationLoading) return;
    locationAttempt.current = true; setLocationRequested(true); nav.start();
  }
  function enableSensor() {
    if (sensorAttempt.current || !sensorSupported || ['requesting', 'waiting'].includes(sensor.status)) return;
    sensorAttempt.current = true; setSensorRequested(true);
    // Invoke directly in the trusted click; iOS requires transient user activation.
    sensor.enable();
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
        {nav.gps.status === 'denied' && <p>{tr('بعد السماح من الإعدادات، أعد دخول الصفحة أو استخدم أزرار التفعيل اليدوية.')}</p>}
      </>}
      <button className="filled" disabled={blocked || !nav.settingsReady || nav.state !== 'connected' || !locationSupported || locationLoading || locationRequested} onClick={enableLocation}>{tr('تفعيل الموقع')}</button>
    </section>}
    {missing.sensor && <section className="permission-requirement" aria-labelledby="sensor-permission-title">
      <h3 id="sensor-permission-title"><Compass size={20}/>{tr('حساس البوصلة')}</h3>
      <p>{tr('يستخدم دال حساس الاتجاه لتحديث سهم البوصلة عند تدوير الجوال. تفعيل الحساس وحده لا يفعّل مشاركة الموقع.')}</p>
      {sensor.status === 'requesting' && <p role="status">{tr('بانتظار قرار إذن الحساس…')}</p>}
      {sensor.status === 'waiting' && <p role="status">{tr('بانتظار قراءة الحساس. ')}</p>}
      {sensor.status === 'denied' && <p role="alert">{tr('إذن الحساس مرفوض. اسمح بالحركة والاتجاه من إعدادات المتصفح أو الجهاز، ثم أعد دخول الصفحة أو استخدم التفعيل اليدوي.')}</p>}
      {(!sensorSupported || sensor.status === 'unavailable') && <p role="alert">{tr('حساس البوصلة غير متاح أو لا يرسل قراءة صالحة. يمكنك استخدام الخريطة أو الاتجاه بالنسبة للشمال.')}</p>}
      <button className="filled" disabled={!sensorSupported || sensorRequested || ['requesting', 'waiting'].includes(sensor.status)} onClick={enableSensor}>{tr('تفعيل حساس البوصلة')}</button>
    </section>}
    <button className="outline full" onClick={() => setOpen(false)}>{tr('ليس الآن')}</button>
    {languageControls}
  </Dialog>;
}
