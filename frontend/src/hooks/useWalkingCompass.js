import { useEffect, useMemo, useRef, useState } from 'react';
import { locationAge, locationVisible, validCoordinates } from '../utils/navigationCalculations.js';
import { advanceCompassWaypoint, compassPath } from '../utils/walkingCompass.js';

export default function useWalkingCompass({ walking, own, target, online, now, gpsReady, authorized, destinationKey }) {
  const [choice, setChoice] = useState(null), [hadRoute, setHadRoute] = useState(false);
  const result = walking?.result;
  const path = useMemo(() => compassPath(result?.coordinates), [result?.coordinates]);
  const previous = useRef(null);
  const scope = `${destinationKey}:${result?.key}:${result?.calculatedAt}`;
  const status = walking?.blocked || !authorized || !validCoordinates(target) || (target.userId && !locationVisible(target, now)) ? 'blocked'
    : !online ? 'offline'
    : !gpsReady || !validCoordinates(own) || locationAge(own, now) > 30000 ? 'gps'
    : target.userId && locationAge(target, now) > 30000 ? 'stale'
    : walking?.updating || result?.updating || result?.status === 'LOADING' ? 'updating'
    : !walking?.available || walking?.outdated || result?.outdated || result?.failed || result?.offline || result?.status !== 'READY' || result.key !== destinationKey || !(result.distanceMeters > 0) || !(result.durationSeconds > 0) || !Number.isFinite(result?.calculatedAt) || now - result.calculatedAt >= 30000 || result.calculatedAt > now + 1000 || !path ? 'unavailable' : 'ready';
  const guidance = useMemo(() => status === 'ready' ? advanceCompassWaypoint(path, own, previous.current?.scope === scope ? previous.current : null) : { status }, [path, own?.latitude, own?.longitude, own?.accuracy, own?.recordedAt, scope, status]);
  useEffect(() => {
    if (guidance.status === 'ready') previous.current = { ...guidance, scope };
    // Temporary loss keeps progress for this geometry, but never exposes a bearing.
    else if (previous.current?.scope !== scope || ['blocked', 'stale'].includes(guidance.status)) previous.current = null;
  }, [guidance, scope]);
  useEffect(() => { if (status === 'ready') setHadRoute(true); }, [status]);
  // Once walking was displayed, a lost route stays in walking mode with an explanation.
  // Mode buttons only change presentation; all requests stay in useWalkingRoute.
  return { ...guidance, mode: choice || (hadRoute || status === 'ready' ? 'walking' : 'direct'), setMode: setChoice };
}
