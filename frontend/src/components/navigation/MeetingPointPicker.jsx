import React, { useEffect, useState } from 'react';
export default function MeetingPointPicker({ meeting, draft, onDraft, save, remove, busy, canManage, online }) {
  const [name, setName] = useState(meeting?.name || '');
  useEffect(() => setName(meeting?.name || ''), [meeting?.name]);
  if (!canManage) return <p className="field-help">المالك والمسؤول فقط يمكنهما تعديل نقطة اللقاء.</p>;
  const point = draft || meeting;
  return <form className="nav-meeting-form" onSubmit={event => { event.preventDefault(); save({ name: name.trim(), latitude: Number(event.currentTarget.latitude.value), longitude: Number(event.currentTarget.longitude.value) }); }}>
    <p>اضغط على الخريطة لتحديد نقطة اللقاء، أو أدخل الإحداثيات.</p>
    <label>اسم نقطة اللقاء<input required maxLength={100} value={name} onChange={event => setName(event.target.value)}/></label>
    <div className="pair"><label>خط العرض<input key={`lat:${point?.latitude}`} name="latitude" type="number" step="any" min="-90" max="90" required defaultValue={point?.latitude ?? ''}/></label><label>خط الطول<input key={`lon:${point?.longitude}`} name="longitude" type="number" step="any" min="-180" max="180" required defaultValue={point?.longitude ?? ''}/></label></div>
    <div className="pair"><button className="filled" disabled={busy || !online}>حفظ نقطة اللقاء</button>{draft && <button className="outline" type="button" onClick={() => onDraft(null)}>إلغاء الاختيار</button>}{meeting && <button className="outline danger" type="button" disabled={busy || !online} onClick={remove}>حذف نقطة اللقاء</button>}</div>
  </form>;
}
