export function passwordIssues(password) {
  return [password.length < 8 && 'أضف 8 أحرف على الأقل', !/[A-Z]/.test(password) && 'أضف حرفًا كبيرًا واحدًا على الأقل', !/[a-z]/.test(password) && 'أضف حرفًا صغيرًا واحدًا على الأقل', !/[0-9]/.test(password) && 'أضف رقمًا واحدًا على الأقل', !/[^A-Za-z0-9\s]/.test(password) && 'أضف رمزًا واحدًا على الأقل'].filter(Boolean);
}
export function formatDate(value, hour12 = false) {
  if (!value) return '—';
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '—';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12 }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}/${parts.month}/${parts.day} - ${parts.hour}:${parts.minute}${hour12 ? ' ' + parts.dayPeriod.toUpperCase() : ''}`;
}
export const pageItems = value => Array.isArray(value) ? value : value?.content || [];
