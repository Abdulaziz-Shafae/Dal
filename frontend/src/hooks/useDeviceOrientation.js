import { useEffect, useState } from 'react';
import { headingFromEvent } from '../utils/navigationCalculations.js';
export default function useDeviceOrientation() {
  const [enabled, setEnabled] = useState(false), [heading, setHeading] = useState(null), [status, setStatus] = useState('idle');
  async function enable() {
    const sensor = window.DeviceOrientationEvent;
    if (!window.isSecureContext || !sensor) { setStatus('unavailable'); return; }
    try {
      if (typeof sensor.requestPermission === 'function' && await sensor.requestPermission(true) !== 'granted') { setStatus('denied'); return; }
      setStatus('waiting'); setEnabled(true);
    } catch { setStatus('denied'); }
  }
  useEffect(() => {
    if (!enabled) return;
    let expiry;
    const update = event => {
      const value = headingFromEvent(event, window.screen.orientation?.angle ?? window.orientation ?? 0);
      if (value === null) return;
      setHeading(value); setStatus('ready'); clearTimeout(expiry);
      expiry = setTimeout(() => { setHeading(null); setStatus('unavailable'); }, 5000);
    };
    const hidden = () => { if (document.hidden) { setHeading(null); setEnabled(false); setStatus('idle'); } };
    expiry = setTimeout(() => setStatus('unavailable'), 5000);
    window.addEventListener('deviceorientationabsolute', update);
    window.addEventListener('deviceorientation', update);
    document.addEventListener('visibilitychange', hidden);
    return () => { clearTimeout(expiry); window.removeEventListener('deviceorientationabsolute', update); window.removeEventListener('deviceorientation', update); document.removeEventListener('visibilitychange', hidden); };
  }, [enabled]);
  return { heading, status, enable };
}
