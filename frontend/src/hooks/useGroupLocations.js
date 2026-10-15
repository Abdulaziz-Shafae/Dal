import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import useGeolocation from './useGeolocation.js';
import { createLocationPublisher, optionalMeeting } from '../services/locationService.js';
import { visibleLocations, globalSharingAllowed } from '../utils/navigationCalculations.js';

export default function useGroupLocations({ user, group, active, sharing, groupSharing, onSessionExpired, onSnapshot }) {
  const scope = `${user?.id}:${group?.id}`;
  const period = JSON.stringify([sharing?.sharingMode, sharing?.startTime, sharing?.endTime]);
  const [consent, setConsent] = useState(null), [visible, setVisible] = useState(!document.hidden);
  const [data, setData] = useState({ scope: '', rows: [], meeting: null, state: 'loading', permissions: null, checkedAt: 0, expired: false });
  const [tick, setNow] = useState(Date.now()), [uploadError, setUploadError] = useState('');
  // Visibility recovery must enforce deadlines before a throttled interval fires.
  const now = Math.max(tick, Date.now());
  const [attempt, setAttempt] = useState(0);
  const current = useRef({});
  const authorization = useRef({ stamp: '', revision: 0 });
  const stamp = JSON.stringify([scope, sharing?.sharingEnabled, sharing?.sharingMode, sharing?.isPaused, sharing?.pausedUntil, sharing?.startTime, sharing?.endTime, sharing?.updatedAt, groupSharing?.sharingEnabled, groupSharing?.isPaused, groupSharing?.pausedUntil, group?.status]);
  if (authorization.current.stamp !== stamp) authorization.current = { stamp, revision: authorization.current.revision + 1 };
  const publisher = useRef(null);
  if (!publisher.current) publisher.current = createLocationPublisher(api.saveLocation);
  const scoped = data.scope === scope ? data : { rows: [], meeting: null, state: 'loading', permissions: null, checkedAt: 0, expired: false };
  const enabled = Boolean(active && visible && consent === scope && globalSharingAllowed(sharing, now) && groupSharing?.sharingEnabled === true && scoped.permissions?.global && scoped.permissions?.group && now - scoped.checkedAt < 30000);
  current.current = { scope, enabled, onSessionExpired, onSnapshot };
  const gps = useGeolocation(enabled, attempt, scope);
  const starting = useRef(false);
  useEffect(() => {
    if (gps.status !== 'loading') starting.current = false;
    // Unknown permission pauses consent, but is not a fabricated denial.
    if ((gps.status === 'denied' || (gps.status === 'idle' && gps.error)) && gps.attempt === attempt) setConsent(null);
  }, [gps.status, gps.error, gps.attempt, attempt]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', change); };
  }, []);
  useEffect(() => { publisher.current = createLocationPublisher(api.saveLocation); setConsent(null); setUploadError(''); setData({ scope, rows: [], meeting: null, state: 'loading', permissions: null, checkedAt: 0, expired: false }); }, [scope]);
  useEffect(() => {
    if (!sharing?.sharingEnabled || !groupSharing?.sharingEnabled || ['PAUSED', 'CLOSED'].includes(group?.status)) {
      publisher.current = createLocationPublisher(api.saveLocation);
      setConsent(null); setData(old => ({ ...old, rows: ['PAUSED', 'CLOSED'].includes(group?.status) ? [] : old.rows.filter(row => row.userId !== user?.id), permissions: null }));
    }
  }, [sharing?.sharingEnabled, groupSharing?.sharingEnabled, group?.status]);
  useEffect(() => {
    // A successful local mode/schedule change invalidates the owner's previous
    // period. A snapshot already fetched for the new period stays valid.
    if (scoped.period && scoped.period !== period) {
      publisher.current = createLocationPublisher(api.saveLocation);
      setConsent(null); setData(old => old.scope === scope ? { ...old, rows: old.rows.filter(row => row.userId !== user?.id), permissions: null } : old);
    }
  }, [period, scope]);
  useEffect(() => {
    if (!active || !user || !group) return;
    let live = true, pending = false, timer;
    const refresh = async () => {
      if (!live || document.hidden) return;
      if (!navigator.onLine) setData(old => old.scope === scope ? { ...old, state: 'offline', permissions: null } : old);
      if (pending) return;
      clearTimeout(timer); pending = true;
      const revision = authorization.current.revision;
      if (navigator.onLine) setData(old => old.scope === scope && old.state === 'offline' ? { ...old, rows: [], state: 'loading', permissions: null } : old);
      try {
        if (!navigator.onLine) throw { status: 0 };
        // Check access and permissions before accepting coordinates, including cached own location.
        const [settings, membership] = await Promise.all([api.sharing(), api.groupSharing(group.id)]);
        const [rows, meeting, members, freshGroup] = await Promise.all([api.locations(group.id), optionalMeeting(group.id), api.members(group.id), api.group(group.id)]);
        if (!live || current.current.scope !== scope || authorization.current.revision !== revision) return;
        if (!navigator.onLine) throw { status: 0 };
        // Only the group-authorized response can supply cached group coordinates.
        const permittedRows = visibleLocations(rows);
        setData({ scope, rows: permittedRows, meeting, state: 'connected', checkedAt: Date.now(), expired: false, period: JSON.stringify([settings.sharingMode, settings.startTime, settings.endTime]), permissions: { global: globalSharingAllowed(settings), group: membership.sharingEnabled, interval: settings.updateIntervalSeconds } });
        current.current.onSnapshot?.({ settings, membership, members, group: freshGroup, meeting });
        if (!globalSharingAllowed(settings) || !membership.sharingEnabled) setConsent(null);
      } catch (error) {
        if (!live || current.current.scope !== scope || authorization.current.revision !== revision) return;
        const network = error.status === 0 || error.status >= 500;
        setData(old => ({ ...old, scope, state: network ? 'offline' : 'error', ...(network ? {} : { rows: [], meeting: null }), permissions: null }));
        if (!network) setConsent(null);
        if (error.status === 401) current.current.onSessionExpired(error);
      } finally {
        pending = false;
        if (live) timer = setTimeout(refresh, 10000);
      }
    };
    refresh(); window.addEventListener('online', refresh); window.addEventListener('offline', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { live = false; clearTimeout(timer); window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [scope, active]);
  useEffect(() => {
    if (!enabled || !gps.point || !navigator.onLine || scoped.state !== 'connected') return;
    const upload = async () => {
      if (!current.current.enabled || current.current.scope !== scope) return;
      const revision = authorization.current.revision;
      try {
        await publisher.current.publish(gps.point, Math.max(1000, (scoped.permissions?.interval || sharing?.updateIntervalSeconds || 15) * 1000));
        if (current.current.scope === scope && authorization.current.revision === revision) setUploadError('');
      } catch (error) {
        if (current.current.scope !== scope || authorization.current.revision !== revision) return;
        setUploadError('تعذر إرسال موقعك. سنحاول عند توفر الاتصال.');
        if (error.status !== 0 && error.status < 500) setConsent(null);
        if (error.status === 401) current.current.onSessionExpired(error);
      }
    };
    upload(); const timer = setInterval(upload, 1000); return () => clearInterval(timer);
  }, [enabled, gps.point, scope, scoped.state, scoped.permissions?.interval]);
  useEffect(() => {
    if (visibleLocations(scoped.rows, now).length < scoped.rows.length) setData(old => old.scope !== scope ? old : { ...old, rows: visibleLocations(old.rows, now), expired: true });
  }, [now, scoped.rows, scope]);
  const rows = visibleLocations(scoped.rows, now);
  return { rows, meeting: scoped.meeting, expired: scoped.expired, state: scoped.state, now, gps, uploadError, enabled, consent: consent === scope,
    routeAuthorizationKey: `${scope}:${authorization.current.revision}`,
    routeAuthorized: Boolean(user && group && active && globalSharingAllowed(sharing, now) && groupSharing?.sharingEnabled === true && !['PAUSED', 'CLOSED'].includes(group.status) && scoped.state !== 'error'),
    settingsReady: sharing != null && groupSharing != null,
    sharingAllowed: globalSharingAllowed(sharing, now) && groupSharing?.sharingEnabled === true,
    start: () => {
      if (starting.current || gps.status === 'loading' || (enabled && gps.status === 'ready') || !active || !visible || !globalSharingAllowed(sharing, now) || groupSharing?.sharingEnabled !== true || ['PAUSED', 'CLOSED'].includes(group?.status) || scoped.state !== 'connected' || !scoped.permissions?.global || !scoped.permissions?.group || now - scoped.checkedAt >= 30000) return false;
      starting.current = true; setConsent(scope); setAttempt(value => value + 1); return true;
    }, stop: () => { starting.current = false; setConsent(null); setData(old => ({ ...old, rows: old.rows.filter(row => row.userId !== user?.id) })); },
    setMeeting: meeting => setData(old => ({ ...old, meeting })),
    clear: () => { setConsent(null); setData(old => ({ ...old, rows: [], meeting: null, permissions: null })); }
  };
}
