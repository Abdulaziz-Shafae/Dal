import { useEffect, useRef, useState } from 'react';
import { headingFromEvent } from '../utils/navigationCalculations.js';
export default function useDeviceOrientation(active = true) {
  const [enabled, setEnabled] = useState(false), [heading, setHeading] = useState(null), [status, setStatus] = useState('idle');
  const granted = useRef(false);
  const requesting = useRef(false);
  async function enable() {
    if (requesting.current) return;
    const sensor = window.DeviceOrientationEvent;
    if (!window.isSecureContext || !sensor) { setStatus('unavailable'); return; }
    requesting.current = true;
    try {
      if (typeof sensor.requestPermission === 'function' && !granted.current) {
        setStatus('requesting');
        granted.current = await sensor.requestPermission(true) === 'granted';
        if (!granted.current) { setHeading(null); setEnabled(false); setStatus('denied'); return; }
      }
      setStatus('waiting'); setEnabled(true);
    } catch { granted.current = false; setHeading(null); setEnabled(false); setStatus('denied'); }
    finally { requesting.current = false; }
  }
  useEffect(() => {
    if (!enabled || !active) { setHeading(null); return; }
    let expiry;
    const update = event => {
      if (document.hidden) return;
      const value = headingFromEvent(event, window.screen.orientation?.angle ?? window.orientation ?? 0);
      if (value === null) return;
      setHeading(value); setStatus('ready'); clearTimeout(expiry);
      expiry = setTimeout(() => { setHeading(null); setStatus('unavailable'); }, 5000);
    };
    const hidden = () => { setHeading(null); clearTimeout(expiry); if (!document.hidden) { setStatus('waiting'); expiry = setTimeout(() => setStatus('unavailable'), 5000); } };
    expiry = setTimeout(() => setStatus('unavailable'), 5000);
    window.addEventListener('deviceorientationabsolute', update);
    window.addEventListener('deviceorientation', update);
    document.addEventListener('visibilitychange', hidden);
    return () => { clearTimeout(expiry); window.removeEventListener('deviceorientationabsolute', update); window.removeEventListener('deviceorientation', update); document.removeEventListener('visibilitychange', hidden); };
  }, [enabled, active]);
  return { heading, status, enable, enabled };
}
