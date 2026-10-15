import { useEffect, useRef, useState } from 'react';
import { headingFromEvent } from '../utils/navigationCalculations.js';
import { orientationSupported } from '../utils/navigationPermissions.js';
export default function useDeviceOrientation(active = true) {
  const [enabled, setEnabled] = useState(false), [heading, setHeading] = useState(null), [status, setStatus] = useState('idle');
  const granted = useRef(false);
  const requesting = useRef(false);
  const reading = useRef(false);
  const [attempt, setAttempt] = useState(0);
  async function enable() {
    if (requesting.current || reading.current) return;
    const sensor = window.DeviceOrientationEvent;
    if (!window.isSecureContext || !sensor) { setStatus('unavailable'); return; }
    requesting.current = true;
    try {
      if (typeof sensor.requestPermission === 'function' && !granted.current) {
        setStatus('requesting');
        const permission = await sensor.requestPermission(true);
        granted.current = permission === 'granted';
        if (!granted.current) { setHeading(null); setEnabled(false); setStatus(permission === 'denied' ? 'denied' : 'error'); return; }
      }
      reading.current = true;
      setHeading(null); setStatus('waiting'); setEnabled(true); setAttempt(value => value + 1);
    } catch (error) { granted.current = false; setHeading(null); setEnabled(false); setStatus(error.name === 'NotAllowedError' ? 'denied' : 'error'); }
    finally { requesting.current = false; }
  }
  useEffect(() => {
    if (!enabled || !active) { reading.current = false; setHeading(null); return; }
    let expiry;
    const expired = () => { reading.current = false; setHeading(null); setStatus('unavailable'); };
    const wait = () => { reading.current = true; setStatus('waiting'); clearTimeout(expiry); expiry = setTimeout(expired, 5000); };
    const update = event => {
      if (document.hidden) return;
      const value = headingFromEvent(event, window.screen.orientation?.angle ?? window.orientation ?? 0);
      if (value === null) return;
      reading.current = false; setHeading(value); setStatus('ready'); clearTimeout(expiry);
      expiry = setTimeout(expired, 5000);
    };
    const hidden = () => { reading.current = false; setHeading(null); clearTimeout(expiry); if (!document.hidden) wait(); };
    wait();
    window.addEventListener('deviceorientationabsolute', update);
    window.addEventListener('deviceorientation', update);
    document.addEventListener('visibilitychange', hidden);
    return () => { reading.current = false; clearTimeout(expiry); window.removeEventListener('deviceorientationabsolute', update); window.removeEventListener('deviceorientation', update); document.removeEventListener('visibilitychange', hidden); };
  }, [enabled, active, attempt]);
  return { heading, status, enable, enabled, supported: orientationSupported() };
}
