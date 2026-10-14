import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { distanceBetween, validCoordinates, locationAge, locationVisible } from '../utils/navigationCalculations.js';

export function routeNeedsUpdate(previous, own, target, key, now) {
  return !previous || previous.key !== key || now - previous.time >= 30000 || distanceBetween(previous.own, own) >= 25 || distanceBetween(previous.target, target) >= 25;
}
export default function useWalkingRoute({ groupId, own, target, online, consent, now }) {
  const [preview, setPreview] = useState(false), [guiding, setGuiding] = useState(false), [result, setResult] = useState(null);
  const last = useRef(null), pending = useRef(false), generation = useRef(0), requestedAt = useRef(0);
  const key = `${groupId}:${target?.userId || (target ? 'meeting' : '')}`;
  const available = consent && validCoordinates(own) && validCoordinates(target) && (!target.userId || (locationVisible(target, now) && locationAge(target, now) <= 30000)) && locationAge(own, now) <= 30000;
  const scope = useRef(key);
  if (scope.current !== key) { scope.current = key; generation.current++; }
  useEffect(() => { last.current = null; setResult(null); }, [key]);
  useEffect(() => {
    if (!available || !preview || !online) { generation.current++; last.current = null; setResult(null); return; }
    if (pending.current || !routeNeedsUpdate(last.current, own, target, key, now)) return;
    const version = generation.current;
    const timer = setTimeout(async () => {
      if (pending.current) return;
      pending.current = true; requestedAt.current = Date.now();
      setResult({ status: 'LOADING', key });
      try {
        const value = await api.walkingRoute(groupId, { memberId: target.userId || null, meetingPoint: !target.userId });
        if (generation.current === version) { last.current = { own, target, key, time: Date.now() }; setResult({ ...value, key }); }
      } catch (error) {
        if (generation.current === version) { last.current = { own, target, key, time: Date.now() }; setResult({ status: error.status >= 400 && error.status < 500 ? 'LOCATION_UNAVAILABLE' : 'UNAVAILABLE', message: error.message, key }); }
      } finally { pending.current = false; }
    }, Math.max(800, requestedAt.current + 10000 - Date.now()));
    return () => clearTimeout(timer);
  }, [key, own?.latitude, own?.longitude, target?.latitude, target?.longitude, available, preview, online, Math.floor(now / 1000)]);
  useEffect(() => () => { generation.current++; }, []);
  const validResult = available && preview && online && result?.key === key && (result.status === 'LOADING' || !last.current || !routeNeedsUpdate(last.current, own, target, key, now)) ? result : null;
  return { result: validResult, guiding: guiding && available && preview, preview, available,
    select: () => { generation.current++; last.current = null; setResult(null); setPreview(true); },
    start: () => { if (['UNAVAILABLE', 'LOCATION_UNAVAILABLE'].includes(result?.status)) { generation.current++; last.current = null; setResult(null); } setPreview(true); setGuiding(true); },
    stop: () => { generation.current++; setPreview(false); setGuiding(false); setResult(null); last.current = null; } };
}
