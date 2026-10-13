import React from 'react';
export function badgeLabel(count) { return Number.isFinite(count) && count > 0 ? count > 99 ? '99+' : String(Math.floor(count)) : ''; }
export default function NotificationBadge({ count }) { const label = badgeLabel(count); return label ? <span className="notification-badge" aria-label={`${count} إشعارًا غير مقروء`}>{label}</span> : null; }
