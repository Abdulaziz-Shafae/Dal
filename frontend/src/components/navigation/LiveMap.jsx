import { useLanguage } from '../../LanguageContext.jsx';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { distanceBetween, locationLabel, locationStatus, validCoordinates } from '../../utils/navigationCalculations.js';
function Controls({ focus, onPick, picking, visible }) {
  const { tr } = useLanguage();
  const map = useMap();
  useEffect(() => { if (visible) map.invalidateSize(); }, [visible, map]);
  useEffect(() => {
    const controls = map.zoomControl?.getContainer();
    for (const [selector, key] of [['.leaflet-control-zoom-in', 'تكبير الخريطة'], ['.leaflet-control-zoom-out', 'تصغير الخريطة']]) {
      const button = controls?.querySelector(selector);
      button?.setAttribute('title', tr(key)); button?.setAttribute('aria-label', tr(key));
    }
  }, [map, tr]);
  useEffect(() => { if (validCoordinates(focus?.point)) map.setView([focus.point.latitude, focus.point.longitude], 17); }, [focus, map]);
  useMapEvents({ click: event => { if (picking) onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng }); } });
  return null;
}
const meetingPinIcon = L.divIcon({ className: 'dal-meeting-pin', html: '<svg width="38" height="48" viewBox="0 0 38 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 2C9.6 2 2 9.6 2 19c0 13.2 17 26.5 17 26.5S36 32.2 36 19C36 9.6 28.4 2 19 2Z" fill="#004432" stroke="#ffffff" stroke-width="3"/><circle cx="19" cy="19" r="9" fill="#2bba95"/><path d="M14 19h10M19 14v10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>', iconSize: [38, 48], iconAnchor: [19, 46], popupAnchor: [0, -40] });
function Point({ point, own, meeting, onSelect, origin, now, online }) {
  const { tr, lang, direction } = useLanguage();
  const distance = distanceBetween(origin, point);
  return <CircleMarker center={[point.latitude, point.longitude]} radius={meeting ? 13 : own ? 11 : 9} pathOptions={{ color: own ? '#004432' : meeting ? '#004432' : '#1b9151', fillColor: meeting ? '#e3f4ee' : own ? '#2bba95' : '#1b9151', fillOpacity: 1, weight: meeting ? 4 : 2 }} eventHandlers={{ click: () => onSelect?.(point) }}>
    <Tooltip permanent direction="top">{own ? tr("أنت") : meeting ? tr("نقطة اللقاء") : point.name?.[0] || tr("عضو")}{!own && !meeting && <small> · {locationStatus(point, now, online, lang)}</small>}</Tooltip>
    <Popup><b>{own ? tr("أنت") : point.name}</b><p>{distance === null ? tr("المسافة المباشرة غير متاحة") : tr("المسافة المباشرة: {0} م", Math.round(distance))}</p><p>{locationLabel(point, Date.now(), lang)}</p>{Number.isFinite(point.accuracy) && <p>{tr("الدقة ±")}{Math.round(point.accuracy)} {tr("م")}</p>}</Popup>
  </CircleMarker>;
}
export default function LiveMap({ rows, own, userId, meeting, selected, onSelect, picking = false, onPick, draft, route, now = Date.now(), online = navigator.onLine, expired = false }) {
 const { tr, lang, direction } = useLanguage();
  const [focus, setFocus] = useState(null), [tileError, setTileError] = useState(false);
  useEffect(() => { if (validCoordinates(selected)) setFocus({ point: selected }); }, [selected?.userId]);
  useEffect(() => { if (own && !focus) setFocus({ point: own }); }, [own]);
  // Keep the mounted map and already loaded tiles during disconnects. Tiles
  // that cannot load use the existing information fallback, without remounting.
  const fallback = tileError || (!navigator.onLine && route?.status !== 'READY');
  return <div className={`dal-live-map${fallback ? ' has-map-fallback' : ''}`}>
    {!own && <p className="field-help">{tr("الرياض مركز عرض افتراضي فقط، وليست موقعك.")}</p>}
    <div className="nav-map-toolbar"><button className="outline" disabled={!own} onClick={() => setFocus({ point: own })}>{tr("تمركز على موقعي")}</button>{selected && <button className="outline" disabled={!validCoordinates(selected)} onClick={() => setFocus({ point: selected })}>{tr("ركّز على")} {selected.name}</button>}</div>
    {fallback && <div className="nav-connection offline" role="status">{tr("الخريطة غير متاحة حاليًا. استخدم المعلومات والإحداثيات أدناه.")} {navigator.onLine && <button className="outline" onClick={() => setTileError(false)}>{tr("إعادة المحاولة")}</button>}</div>}
    {!online && route?.status === 'READY' && <p className="nav-connection offline" role="status">{tr('الاتصال منقطع. هذا آخر مسار محسوب وقد لا يعكس موقعك الحالي.')}</p>}
    <div hidden={fallback}><MapContainer center={[24.7136, 46.6753]} zoom={12} className="dal-map-canvas" scrollWheelZoom aria-label={tr("خريطة المجموعة")}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} maxZoom={19} updateWhenIdle keepBuffer={1} eventHandlers={{ tileerror: () => setTileError(true) }}/>
      <Controls focus={focus} picking={picking} onPick={onPick} visible={!fallback}/>
      {route?.status === 'READY' && <Polyline positions={route.coordinates} pathOptions={{ color: '#2bba95', weight: 6, opacity: route.outdated ? .6 : .95, dashArray: route.outdated && !route.updating ? '8 10' : undefined }}/>}
      {route?.status === 'UNAVAILABLE' && validCoordinates(own) && validCoordinates(selected) && <Polyline positions={[[own.latitude, own.longitude], [selected.latitude, selected.longitude]]} pathOptions={{ color: '#004432', weight: 4, dashArray: '8 10' }}><Tooltip>{tr("اتجاه مباشر، وليس طريق مشي")}</Tooltip></Polyline>}
      {own && <Point point={own} own origin={own}/>}
      {rows.filter(row => row.userId !== userId).map(row => <Point key={row.userId} point={row} origin={own} onSelect={onSelect} now={now} online={online}/>)}
      {validCoordinates(meeting) && <Marker position={[meeting.latitude, meeting.longitude]} icon={meetingPinIcon} eventHandlers={{ click: () => onSelect?.(meeting) }}><Tooltip direction="top">{tr("نقطة اللقاء")}: {meeting.name}</Tooltip><Popup><b>{tr("نقطة اللقاء")}: {meeting.name}</b><p>{distanceBetween(own, meeting) === null ? tr("المسافة المباشرة غير متاحة") : tr("المسافة المباشرة: {0} م", Math.round(distanceBetween(own, meeting)))}</p></Popup></Marker>}
      {validCoordinates(draft) && <CircleMarker center={[draft.latitude, draft.longitude]} radius={14} pathOptions={{ color: '#004432', dashArray: '5 5' }}><Tooltip permanent>{tr("النقطة المختارة · لم تحفظ بعد")}</Tooltip></CircleMarker>}
    </MapContainer></div>
    {fallback && <div className="nav-offline-list">{expired && <p role="status">{tr("انتهت مدة مشاركة الموقع.")}</p>}{[...(validCoordinates(meeting) ? [{ ...meeting, name: tr("نقطة اللقاء: {0}", meeting.name) }] : []), ...rows].map((p, i) => <p key={i}><b>{p.name}</b><br/><span dir="ltr">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</span><br/>{p.userId ? `${locationStatus(p, now, online, lang)} · ${locationLabel(p, now, lang)}` : tr("نقطة لقاء ثابتة")}</p>)}{!meeting && !rows.length && <p>{tr("لا توجد معلومات محفوظة متاحة.")}</p>}</div>}
  </div>;
}
