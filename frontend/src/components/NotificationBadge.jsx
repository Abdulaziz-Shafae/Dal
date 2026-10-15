import { useLanguage } from '../LanguageContext.jsx';
import React from 'react';
export function badgeLabel(count) { return Number.isFinite(count) && count > 0 ? count > 99 ? '99+' : String(Math.floor(count)) : ''; }
export default function NotificationBadge({ count }) {
  const { tr } = useLanguage(); const label = badgeLabel(count); return label ? <span className="notification-badge" aria-label={tr("{0} إشعارًا غير مقروء", count)}>{label}</span> : null; }
