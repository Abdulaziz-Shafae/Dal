import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { pageItems, mergeConversationPage } from '../utils.js';

export default function GroupChat({ group, user, online, labelDate, onError, tabs }) {
  const [messages, setMessages] = useState([]), [draft, setDraft] = useState(''), [busy, setBusy] = useState(false), [status, setStatus] = useState('loading'), [page, setPage] = useState(0), [more, setMore] = useState(false), [unread, setUnread] = useState(0);
  const pending = useRef(false), retry = useRef(null), mounted = useRef(true), loadedPage = useRef(0);
  async function refresh(older = false) {
    if (pending.current || !online || document.hidden) return;
    pending.current = true;
    try {
      const index = older ? loadedPage.current + 1 : 0;
      const value = await api.groupConversation(group.id, index), rows = pageItems(value).slice().reverse();
      if (!mounted.current) return;
      setMessages(previous => mergeConversationPage(previous, rows, older, loadedPage.current > 0)); setStatus('ready');
      if (older || loadedPage.current === 0) { setMore(!value.last); setPage(index); loadedPage.current = index; }
      setUnread((await api.groupUnread(group.id)).count);
      if (rows.length) { await api.readGroupMessages(group.id, Math.max(...rows.map(m => m.id))); if (mounted.current) setUnread((await api.groupUnread(group.id)).count); }
    } catch (error) { if (mounted.current) { setStatus('error'); if (error.status >= 400 && error.status < 500) setMessages([]); onError(error); } }
    finally { pending.current = false; }
  }
  useEffect(() => { mounted.current = true; refresh(); const timer = setInterval(() => refresh(), 8000); return () => { mounted.current = false; clearInterval(timer); }; }, [group.id, online]);
  async function send(e) {
    e.preventDefault(); if (busy || !draft.trim()) return;
    const content = draft.trim();
    if (!retry.current || retry.current.content !== content) retry.current = { content, clientMessageId: crypto.randomUUID() };
    setBusy(true);
    try { await api.sendGroupMessage(group.id, retry.current); if (mounted.current) { retry.current = null; setDraft(''); await refresh(); } }
    catch (error) { if (mounted.current) onError(error); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="chat-page">{tabs}<div className="chat-heading"><h2>محادثة المجموعة · {group.name}</h2><small>{unread ? `${unread} غير مقروءة` : 'رسائل المجموعة'}</small></div><div className="messages" aria-live="polite">{more && <button className="text-link" disabled={busy} onClick={() => refresh(true)}>تحميل الرسائل السابقة</button>}{status === 'loading' && <p>جارٍ تحميل المحادثة…</p>}{status === 'error' && <p role="alert">تعذر تحديث المحادثة؛ سنحاول مجددًا عند توفر الاتصال.</p>}{status === 'ready' && !messages.length && <p>ابدأ محادثة المجموعة</p>}{messages.map(m => <article key={m.id} className={`message ${m.senderId === user.id ? 'mine' : ''}`}><b>{m.senderName}</b><p dir="auto">{m.content}</p><small dir="ltr">{labelDate(m.createdAt)}</small></article>)}</div><form className="chat-input" onSubmit={send}><input aria-label="رسالتك للمجموعة" maxLength={1000} required value={draft} onChange={e => setDraft(e.target.value)} placeholder="اكتب للمجموعة…"/><button onPointerDown={event => event.preventDefault()} disabled={busy || !online}>إرسال</button></form></section>;
}
