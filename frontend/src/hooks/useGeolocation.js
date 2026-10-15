import { useEffect, useRef, useState } from 'react';
export default function useGeolocation(enabled, attempt = 0, scope = '') {
  const idle = { point: null, status: 'idle', error: '', scope, attempt };
  const [state, setState] = useState(idle);
  const consumed = useRef({ scope, attempt: 0 });
  const supported = Boolean(window.isSecureContext && navigator.geolocation);
  useEffect(() => {
    const changedScope = consumed.current.scope !== scope;
    if (changedScope) consumed.current = { scope, attempt };
    const explicit = attempt !== consumed.current.attempt;
    // A click interrupted by lost visibility/authorization must not be queued
    // and mistaken for fresh activation on a later automatic resume.
    consumed.current = { scope, attempt };
    if (!enabled) {
      setState(previous => !changedScope && previous.error ? { ...previous, point: null } : idle);
      return;
    }
    const update = value => setState({ ...idle, ...value });
    if (!supported) { update({ status: 'unavailable', error: 'الموقع غير متاح. افتح دال عبر HTTPS وتأكد من دعم جهازك.' }); return; }
    let live = true, watch, permission, deadline, listening = false;
    const stop = () => { listening = false; clearTimeout(deadline); if (watch != null) navigator.geolocation.clearWatch(watch); watch = undefined; };
    const fail = error => {
      if (!live) return;
      stop();
      update({ status: error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : error.code === 2 ? 'unavailable' : 'error',
        error: error.code === 1 ? 'إذن الموقع مرفوض. اسمح بالموقع من إعدادات المتصفح ثم أعد المحاولة.' : error.code === 3 ? 'تأخر تحديد موقعك. جرّب مكانًا مفتوحًا.' : 'تعذر تحديد موقعك حاليًا.' });
    };
    const start = () => {
      if (!live || listening) return;
      listening = true; update({ status: 'loading' });
      // Bound browsers that fail to deliver their native timeout callback.
      deadline = setTimeout(() => { if (listening) fail({ code: 3 }); }, 25000);
      try {
        const id = navigator.geolocation.watchPosition(value => {
          if (!live || !listening) return;
          clearTimeout(deadline);
          update({ status: 'ready', point: { latitude: value.coords.latitude, longitude: value.coords.longitude, accuracy: value.coords.accuracy, recordedAt: new Date(value.timestamp).toISOString() } });
        }, error => { if (live && listening) fail(error); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
        if (listening) watch = id; else navigator.geolocation.clearWatch(id);
      } catch { fail({ code: 0 }); }
    };
    const needsActivation = () => { stop(); update({ error: 'تعذر التحقق من إذن الموقع. فعّله يدويًا للمتابعة؛ لم يُسجّل رفض للإذن.' }); };
    const check = async (initial = false) => {
      try {
        const value = await navigator.permissions?.query({ name: 'geolocation' });
        if (!live) return;
        if (value) {
          if (permission) permission.onchange = null;
          permission = value; permission.onchange = () => check();
        }
        // An old query cannot overwrite the current explicit watch's result.
        if (initial && explicit) return;
        if (value?.state === 'granted') start();
        else if (value?.state === 'denied') fail({ code: 1 });
        else needsActivation();
      } catch { if (live && !(initial && explicit)) needsActivation(); }
    };
    if (explicit) start(); else update(idle);
    check(true);
    // Parent lifecycle handles visibility; it is never an explicit retry.
    return () => { live = false; stop(); if (permission) permission.onchange = null; };
  }, [enabled, attempt, scope, supported]);
  const current = state.scope !== scope ? idle : enabled && state.attempt !== attempt ? { ...idle, status: 'loading' } : state;
  return { ...current, supported };
}
