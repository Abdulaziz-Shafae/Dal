import { validCoordinates } from './navigationCalculations.js';

export const orientationSupported = () => Boolean(typeof window !== 'undefined' && window.isSecureContext && window.DeviceOrientationEvent);

export function locationFeedback(nav) {
  const supported = nav.gps.supported ?? Boolean(window.isSecureContext && navigator.geolocation);
  const loading = nav.gps.status === 'loading';
  return { supported, loading,
    label: loading ? 'جارٍ تحديد موقعك…' : ['denied', 'timeout', 'unavailable', 'error'].includes(nav.gps.status) ? 'إعادة المحاولة' : 'تفعيل الموقع',
    disabled: !supported || loading || !nav.settingsReady || !nav.sharingAllowed || nav.state !== 'connected' };
}

// API presence is not evidence of usable hardware readings. GPS is independent.
export function orientationFeedback(sensor) {
  const supported = sensor.supported ?? orientationSupported();
  const message = !supported ? 'قراءات الاتجاه غير مدعومة في هذا المتصفح أو السياق. يمكنك استخدام الخريطة.'
    : sensor.status === 'denied' ? 'إذن الحساس مرفوض. اسمح بالحركة والاتجاه من إعدادات المتصفح أو الجهاز، ثم أعد دخول الصفحة أو استخدم التفعيل اليدوي.'
    : sensor.status === 'requesting' ? 'بانتظار قرار إذن الحساس…'
    : sensor.status === 'waiting' ? 'بانتظار قراءة الحساس. '
    : sensor.status === 'unavailable' ? 'لم تصل قراءة اتجاه صالحة. قد تكون القراءات غير متاحة على جهازك أو متصفحك؛ جرّب الخريطة أو أعد التفعيل يدويًا.'
    : sensor.status === 'error' ? 'تعذر تفعيل الحساس. اضغط إعادة التفعيل يدويًا؛ لن يُفعّل الموقع.'
    : 'فعّل حساس البوصلة لتحديث السهم عند تدوير الجهاز.';
  return { message, canActivate: supported && sensor.heading === null && !['requesting', 'waiting'].includes(sensor.status) };
}

export function navigationRequirements(view, navigation, sensor) {
  if (!['map', 'compass'].includes(view)) return { location: false, sensor: false };
  return {
    location: !(navigation.consent && navigation.enabled && navigation.gps.status === 'ready' && validCoordinates(navigation.gps.point)),
    sensor: view === 'compass' && !(sensor.enabled && sensor.status === 'ready' && Number.isFinite(sensor.heading))
  };
}
