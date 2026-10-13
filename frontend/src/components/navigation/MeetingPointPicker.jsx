import React, { useEffect, useState } from 'react';
import { validCoordinates } from '../../utils/navigationCalculations.js';
export default function MeetingPointPicker({ meeting, draft, onDraft, save, remove, busy, canManage, online }) {
  const [name, setName] = useState(meeting?.name || '');
  useEffect(() => setName(meeting?.name || ''), [meeting?.name]);
  if (!canManage) return <p className="field-help">المالك والمسؤول فقط يمكنهما تعديل نقطة اللقاء.</p>;
  const point = draft || meeting;
  return <form className="nav-meeting-form" onSubmit={event => { event.preventDefault(); if (validCoordinates(point) && name.trim()) save({ name: name.trim(), latitude: point.latitude, longitude: point.longitude }); }}>
    <p>اضغط على الخريطة لتحديد نقطة اللقاء.</p>
    <label>اسم نقطة اللقاء<input required maxLength={100} value={name} onChange={event => setName(event.target.value)}/></label>
    <p className="meeting-selection" role="status">{validCoordinates(point) ? `${draft ? 'النقطة المختارة' : 'نقطة اللقاء الحالية'}: ${name.trim() || 'أضف اسمًا للنقطة'}` : 'لم تُحدد نقطة على الخريطة بعد'}</p>
    <div className="pair"><button className="filled" disabled={busy || !online || !validCoordinates(point) || !name.trim()}>حفظ نقطة اللقاء</button>{draft && <button className="outline" type="button" disabled={busy} onClick={() => onDraft(null)}>إلغاء الاختيار</button>}{meeting && <button className="outline danger" type="button" disabled={busy || !online} onClick={remove}>حذف نقطة اللقاء</button>}</div>
  </form>;
}
