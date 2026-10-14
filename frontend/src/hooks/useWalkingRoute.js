import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { distanceBetween, validCoordinates, locationAge, locationVisible } from '../utils/navigationCalculations.js';

export function routeNeedsUpdate(previous, own, target, key, now) {
  return !previous || previous.key !== key || now - previous.time >= 30000 || distanceBetween(previous.own, own) >= 25 || distanceBetween(previous.target, target) >= 25;
}
const readyRoute = value => value?.status === 'READY' && Array.isArray(value.coordinates) && value.coordinates.length >= 2 && value.coordinates.every(p => Array.isArray(p) && validCoordinates({ latitude: p[0], longitude: p[1] })) && value.distanceMeters > 0 && value.durationSeconds > 0;
const permittedTarget = (target, now) => validCoordinates(target) && (!target.userId || locationVisible(target, now));
// The existing Backend uses HTTP 400 for these explicit access failures too.
const accessErrors = new Set(['You are not a member of this group', 'Group not found', 'User not found', 'This group is closed', 'This group has no meeting point yet', 'Meeting point not found']);

export default function useWalkingRoute({ groupId, own, target, online, consent, now, destinationId, authorizationKey = '', authorized = true, requestEnabled = true, revalidating = false, waitingForGps = false }) {
  now = Math.max(now, Date.now());
  const [preview, setPreview] = useState(false), [guiding, setGuiding] = useState(false);
  const [successful, setSuccessful] = useState(null), [request, setRequest] = useState(null);
  const last = useRef(null), attempted = useRef(null), pending = useRef(false), generation = useRef(0), requestedAt = useRef(-Infinity);
  const key = `${groupId}:${destinationId ?? (target?.userId || (target ? 'meeting' : ''))}:${authorizationKey}`;
  const available = Boolean(groupId && authorized && consent && requestEnabled && validCoordinates(own) && permittedTarget(target, now) && (!target.userId || locationAge(target, now) <= 30000) && locationAge(own, now) <= 30000 && !revalidating);
  // Revalidation hides Issue #7 coordinates. Keep memory only until confirmed.
  const replacedMeeting = !revalidating && target && !target.userId && last.current?.key === key && last.current.target.id !== target.id;
  const safe = Boolean(groupId && authorized && consent && !replacedMeeting && (revalidating ? permittedTarget(last.current?.target, now) : permittedTarget(target, now)));
  const awaitingFix = waitingForGps && !own && permittedTarget(target, now) && (!target.userId || locationAge(target, now) <= 30000);
  const invalid = !safe || (online && !revalidating && !awaitingFix && !available);
  const context = useRef('');
  const stamp = `${key}:${preview}:${invalid}:${online}:${revalidating}`;
  if (context.current !== stamp) { context.current = stamp; generation.current++; }
  const current = useRef(null);
  current.current = { key, available, online, own, target, now };

  useEffect(() => { last.current = null; attempted.current = null; setSuccessful(null); setRequest(null); }, [key]);
  useEffect(() => { setPreview(false); setGuiding(false); }, [groupId, authorizationKey]);
  useEffect(() => {
    if (invalid) { last.current = null; attempted.current = null; setSuccessful(null); setRequest(preview ? { key, status: 'LOCATION_UNAVAILABLE' } : null); setGuiding(false); setPreview(false); }
  }, [invalid, key]);
  useEffect(() => { if (!online || revalidating) { attempted.current = null; setRequest(null); } }, [online, revalidating]);
  useEffect(() => {
    if (!preview || !available || !online || pending.current) return;
    if (attempted.current?.failed && now - attempted.current.time < 30000) return;
    if (!routeNeedsUpdate(last.current, own, target, key, now) && !attempted.current?.reconnect) return;
    const version = generation.current;
    const timer = setTimeout(async () => {
      if (pending.current || generation.current !== version || !current.current.available || !current.current.online || globalThis.navigator?.onLine === false) return;
      const origin = current.current.own, destination = current.current.target;
      pending.current = true; requestedAt.current = Date.now(); setRequest({ status: 'LOADING', key });
      try {
        const value = await api.walkingRoute(groupId, { memberId: destination.userId || null, meetingPoint: !destination.userId });
        const latest = current.current, time = Math.max(Date.now(), latest.now);
        if (generation.current !== version || latest.key !== key || !latest.online || !latest.available || locationAge(latest.own, time) > 30000 || !permittedTarget(latest.target, time) || (latest.target.userId && locationAge(latest.target, time) > 30000)) return;
        if (readyRoute(value)) {
          last.current = { own: origin, target: destination, key, time };
          attempted.current = { time, failed: false }; setSuccessful({ ...value, key, calculatedAt: time }); setRequest({ status: 'READY', key });
        } else if (value?.status === 'LOCATION_UNAVAILABLE') {
          last.current = null; setSuccessful(null); setRequest({ status: 'LOCATION_UNAVAILABLE', key }); setGuiding(false); setPreview(false);
        } else { attempted.current = { time, failed: true }; setRequest({ status: 'UNAVAILABLE', key }); }
      } catch (error) {
        if (generation.current !== version || current.current.key !== key) return;
        const blocked = [401, 403, 404, 410].includes(error.status) || (error.status === 400 && accessErrors.has(error.message));
        attempted.current = { time: Date.now(), failed: true };
        if (blocked) { last.current = null; setSuccessful(null); setGuiding(false); setPreview(false); }
        setRequest({ status: blocked ? 'LOCATION_UNAVAILABLE' : 'UNAVAILABLE', key });
      } finally { pending.current = false; }
    }, Math.max(800, requestedAt.current + 10000 - Date.now()));
    return () => clearTimeout(timer);
  }, [key, own?.latitude, own?.longitude, target?.latitude, target?.longitude, available, preview, online, revalidating, Math.floor(now / 1000), request]);
  const wasOnline = useRef(online);
  useEffect(() => { if (online && !wasOnline.current) attempted.current = { reconnect: true }; wasOnline.current = online; }, [online]);
  useEffect(() => () => { generation.current++; }, []);

  const geometry = safe && !invalid && !revalidating && preview && successful?.key === key ? successful : null;
  const updating = Boolean(geometry && online && (request?.status === 'LOADING' || routeNeedsUpdate(last.current, own, target, key, now)) && request?.status !== 'UNAVAILABLE');
  const outdated = Boolean(geometry && (!online || !available || updating || attempted.current?.reconnect || request?.status === 'UNAVAILABLE'));
  const result = geometry ? { ...geometry, updating, outdated, offline: !online, failed: request?.status === 'UNAVAILABLE' } : !invalid && preview && request?.key === key ? request : null;
  return { result, updating, outdated, blocked: request?.key === key && request.status === 'LOCATION_UNAVAILABLE', guiding: guiding && available && preview && online && !outdated, preview, available,
    select: () => { generation.current++; last.current = null; attempted.current = null; setSuccessful(null); setRequest(null); setPreview(true); setGuiding(false); },
    start: () => { if (request?.status === 'UNAVAILABLE') { attempted.current = { reconnect: true }; setRequest(null); } setPreview(true); setGuiding(true); },
    stop: () => { generation.current++; setPreview(false); setGuiding(false); setSuccessful(null); setRequest(null); last.current = null; attempted.current = null; }
  };
}
