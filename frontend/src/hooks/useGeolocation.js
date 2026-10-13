import { useEffect, useState } from 'react';
export default function useGeolocation(enabled) {
  const [state, setState] = useState({ point: null, status: 'idle', error: '' });
  useEffect(() => {
    if (!enabled) { setState({ point: null, status: 'idle', error: '' }); return; }
    if (!window.isSecureContext || !navigator.geolocation) {
      setState({ point: null, status: 'unavailable', error: 'الموقع غير متاح. افتح دال عبر HTTPS وتأكد من دعم جهازك.' }); return;
    }
    let live = true, watch;
    setState({ point: null, status: 'loading', error: '' });
    const fail = error => {
      if (!live) return;
      setState({ point: null, status: error.code === 1 ? 'denied' : 'error', error: error.code === 1 ? 'إذن الموقع مرفوض. اسمح بالموقع من إعدادات المتصفح ثم أعد المحاولة.' : error.code === 3 ? 'تأخر تحديد موقعك. جرّب مكانًا مفتوحًا.' : 'تعذر تحديد موقعك حاليًا.' });
      if (error.code === 1 && watch != null) navigator.geolocation.clearWatch(watch);
    };
    try {
      watch = navigator.geolocation.watchPosition(value => {
        if (live) setState({ status: 'ready', error: '', point: { latitude: value.coords.latitude, longitude: value.coords.longitude, accuracy: value.coords.accuracy, recordedAt: new Date(value.timestamp).toISOString() } });
      }, fail, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    } catch { fail({ code: 2 }); }
    return () => { live = false; if (watch != null) navigator.geolocation.clearWatch(watch); };
  }, [enabled]);
  return state;
}
