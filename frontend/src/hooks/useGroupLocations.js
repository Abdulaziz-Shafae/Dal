import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import useGeolocation from './useGeolocation.js';
import { createLocationPublisher, optionalMeeting } from '../services/locationService.js';
import { allowedLocations, CACHE_TTL, globalSharingAllowed, locationAge } from '../utils/navigationCalculations.js';

export default function useGroupLocations({ user, group, active, sharing, groupSharing, onSessionExpired, onSnapshot }) {
  const scope = `${user?.id}:${group?.id}`;
  const [consent, setConsent] = useState(null), [visible, setVisible] = useState(!document.hidden);
  const [data, setData] = useState({ scope: '', rows: [], meeting: null, state: 'loading', permissions: null, checkedAt: 0 });
  const [now, setNow] = useState(Date.now()), [uploadError, setUploadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = useRef({});
  const publisher = useRef(null);
  if (!publisher.current) publisher.current = createLocationPublisher(api.saveLocation);
  const scoped = data.scope === scope ? data : { rows: [], meeting: null, state: 'loading', permissions: null, checkedAt: 0 };
  const enabled = Boolean(active && visible && consent === scope && globalSharingAllowed(sharing, now) && groupSharing?.sharingEnabled === true && scoped.permissions?.global && scoped.permissions?.group && now - scoped.checkedAt < 30000);
  current.current = { scope, enabled, onSessionExpired, onSnapshot };
  const gps = useGeolocation(enabled, attempt);
  useEffect(() => { if (gps.status === 'denied') setConsent(null); }, [gps.status]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', change); };
  }, []);
  useEffect(() => { setConsent(null); setUploadError(''); setData({ scope, rows: [], meeting: null, state: 'loading', permissions: null, checkedAt: 0 }); }, [scope]);
  useEffect(() => {
    if (!sharing?.sharingEnabled || !groupSharing?.sharingEnabled) {
      setConsent(null); setData(old => ({ ...old, rows: [], permissions: null }));
    }
  }, [sharing?.sharingEnabled, groupSharing?.sharingEnabled]);
  useEffect(() => {
    if (!active || !user || !group) return;
    let live = true, pending = false, timer;
    const refresh = async () => {
      if (!live || pending || document.hidden) return;
      clearTimeout(timer); pending = true;
      try {
        if (!navigator.onLine) throw { status: 0 };
        // Check access and permissions before accepting coordinates, including cached own location.
        const [settings, membership] = await Promise.all([api.sharing(), api.groupSharing(group.id)]);
        const [rows, meeting, myLocation, members, freshGroup] = await Promise.all([api.locations(group.id), optionalMeeting(group.id), api.myLocation(), api.members(group.id), api.group(group.id)]);
        if (!live) return;
        const permittedRows = allowedLocations(rows).map(row => row.userId === user.id && myLocation?.sharingEnabled === true && allowedLocations([myLocation]).length && locationAge(myLocation) < locationAge(row) ? myLocation : row).filter(row => locationAge(row) < CACHE_TTL);
        setData({ scope, rows: permittedRows, meeting, state: 'connected', checkedAt: Date.now(), permissions: { global: globalSharingAllowed(settings), group: membership.sharingEnabled, interval: settings.updateIntervalSeconds } });
        current.current.onSnapshot?.({ settings, membership, members, group: freshGroup, meeting });
        if (!globalSharingAllowed(settings) || !membership.sharingEnabled) setConsent(null);
      } catch (error) {
        if (!live) return;
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
      try {
        await publisher.current.publish(gps.point, Math.max(1000, (scoped.permissions?.interval || sharing?.updateIntervalSeconds || 15) * 1000));
        if (current.current.scope === scope) setUploadError('');
      } catch (error) {
        if (current.current.scope !== scope) return;
        setUploadError('تعذر إرسال موقعك. سنحاول عند توفر الاتصال.');
        if (error.status !== 0 && error.status < 500) setConsent(null);
        if (error.status === 401) current.current.onSessionExpired(error);
      }
    };
    upload(); const timer = setInterval(upload, 1000); return () => clearInterval(timer);
  }, [enabled, gps.point, scope, scoped.state, scoped.permissions?.interval]);
  useEffect(() => {
    if (now - scoped.checkedAt >= CACHE_TTL && scoped.checkedAt) setData(old => ({ ...old, rows: [], meeting: null, checkedAt: 0, permissions: null }));
  }, [now, scoped.checkedAt]);
  const freshCache = now - scoped.checkedAt < CACHE_TTL;
  const rows = freshCache ? scoped.rows.filter(row => locationAge(row, now) < CACHE_TTL) : [];
  return { rows, meeting: freshCache ? scoped.meeting : null, state: scoped.state, now, gps, uploadError, enabled, consent: consent === scope,
    settingsReady: sharing != null && groupSharing != null,
    sharingAllowed: globalSharingAllowed(sharing, now) && groupSharing?.sharingEnabled === true,
    start: () => { setConsent(scope); setAttempt(value => value + 1); }, stop: () => { setConsent(null); setData(old => ({ ...old, rows: old.rows.filter(row => row.userId !== user?.id) })); },
    setMeeting: meeting => setData(old => ({ ...old, meeting })),
    clear: () => { setConsent(null); setData(old => ({ ...old, rows: [], meeting: null, permissions: null })); }
  };
}
