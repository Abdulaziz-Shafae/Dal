import { useLanguage } from '../../LanguageContext.jsx';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { distanceBetween, locationLabel, validCoordinates } from '../../utils/navigationCalculations.js';
function Controls({ focus, onPick, picking }) {
  const { tr } = useLanguage();
  const map = useMap();
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
function Point({ point, own, meeting, onSelect, origin }) {
  const { tr, lang, direction } = useLanguage();
  const distance = distanceBetween(origin, point);
  return <CircleMarker center={[point.latitude, point.longitude]} radius={meeting ? 13 : own ? 11 : 9} pathOptions={{ color: own ? '#004432' : meeting ? '#004432' : '#1b9151', fillColor: meeting ? '#e3f4ee' : own ? '#2bba95' : '#1b9151', fillOpacity: 1, weight: meeting ? 4 : 2 }} eventHandlers={{ click: () => onSelect?.(point) }}>
    <Tooltip permanent direction="top">{own ? tr("أنت") : meeting ? tr("نقطة اللقاء") : point.name?.[0] || tr("عضو")}</Tooltip>
    <Popup><b>{own ? tr("أنت") : point.name}</b><p>{distance === null ? tr("المسافة المباشرة غير متاحة") : tr("المسافة المباشرة: {0} م", Math.round(distance))}</p><p>{locationLabel(point, Date.now(), lang)}</p>{Number.isFinite(point.accuracy) && <p>{tr("الدقة ±")}{Math.round(point.accuracy)} {tr("م")}</p>}</Popup>
  </CircleMarker>;
}
export default function LiveMap({ rows, own, userId, meeting, selected, onSelect, picking = false, onPick, draft, route, candidates = [], suggestion }) {
 const { tr, lang, direction } = useLanguage();
  const [focus, setFocus] = useState(null), [tileError, setTileError] = useState(false);
  useEffect(() => { if (validCoordinates(selected)) setFocus({ point: selected }); }, [selected?.userId]);
  useEffect(() => { if (own && !focus) setFocus({ point: own }); }, [own]);
  const fallback = !navigator.onLine || tileError;
  return <div className="dal-live-map">
    {!own && <p className="field-help">{tr("الرياض مركز عرض افتراضي فقط، وليست موقعك.")}</p>}
    <div className="nav-map-toolbar"><button className="outline" disabled={!own} onClick={() => setFocus({ point: own })}>{tr("تمركز على موقعي")}</button>{selected && <button className="outline" disabled={!validCoordinates(selected)} onClick={() => setFocus({ point: selected })}>{tr("ركّز على")} {selected.name}</button>}</div>
    {fallback && <div className="nav-connection offline">{tr("الخريطة غير متاحة حاليًا. استخدم المعلومات والإحداثيات أدناه.")} {navigator.onLine && <button className="outline" onClick={() => setTileError(false)}>{tr("إعادة المحاولة")}</button>}</div>}
    {!fallback && <MapContainer center={[24.7136, 46.6753]} zoom={12} className="dal-map-canvas" scrollWheelZoom aria-label={tr("خريطة المجموعة")}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} maxZoom={19} updateWhenIdle keepBuffer={1} eventHandlers={{ tileerror: () => setTileError(true) }}/>
      <Controls focus={focus} picking={picking} onPick={onPick}/>
      {route?.status === 'READY' && <Polyline positions={route.coordinates} pathOptions={{ color: '#2bba95', weight: 6, opacity: .95 }}/>}
      {route?.status === 'UNAVAILABLE' && validCoordinates(own) && validCoordinates(selected) && <Polyline positions={[[own.latitude, own.longitude], [selected.latitude, selected.longitude]]} pathOptions={{ color: '#004432', weight: 4, dashArray: '8 10' }}><Tooltip>{tr("اتجاه مباشر، وليس طريق مشي")}</Tooltip></Polyline>}
      {candidates.filter(validCoordinates).map((point, i) => <CircleMarker key={`candidate-${i}`} center={[point.latitude, point.longitude]} radius={10} pathOptions={{ color: '#8064a2', dashArray: '4 4' }}><Tooltip>{point.name} {tr("· مرشح")}</Tooltip></CircleMarker>)}
      {validCoordinates(suggestion) && <CircleMarker center={[suggestion.latitude, suggestion.longitude]} radius={15} pathOptions={{ color: '#a56700', fillColor: '#ffd77a', fillOpacity: .8 }}><Tooltip permanent>{suggestion.name} {tr("· مقترحة ولم تحفظ")}</Tooltip></CircleMarker>}
      {own && <Point point={own} own origin={own}/>}
      {rows.filter(row => row.userId !== userId).map(row => <Point key={row.userId} point={row} origin={own} onSelect={onSelect}/>)}
      {validCoordinates(meeting) && <Point point={meeting} meeting origin={own} onSelect={onSelect}/>}
      {validCoordinates(draft) && <CircleMarker center={[draft.latitude, draft.longitude]} radius={14} pathOptions={{ color: '#004432', dashArray: '5 5' }}><Tooltip permanent>{tr("النقطة المختارة · لم تحفظ بعد")}</Tooltip></CircleMarker>}
    </MapContainer>}
    {fallback && <div className="nav-offline-list">{[...(meeting ? [{ ...meeting, name: tr("نقطة اللقاء: {0}", meeting.name) }] : []), ...rows].map((p, i) => <p key={i}><b>{p.name}</b><br/><span dir="ltr">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</span><br/>{locationLabel(p, Date.now(), lang)}</p>)}{!meeting && !rows.length && <p>{tr("لا توجد معلومات محفوظة متاحة.")}</p>}</div>}
  </div>;
}
