export function passwordIssues(password) {
  return [password.length < 8 && 'أضف 8 أحرف على الأقل', !/[A-Z]/.test(password) && 'أضف حرفًا كبيرًا واحدًا على الأقل', !/[a-z]/.test(password) && 'أضف حرفًا صغيرًا واحدًا على الأقل', !/[0-9]/.test(password) && 'أضف رقمًا واحدًا على الأقل', !/[\p{P}\p{S}]/u.test(password) && 'أضف رمزًا واحدًا على الأقل', new TextEncoder().encode(password).length > 72 && 'الباسوورد طويل جدًا. استخدم أحرفًا أقل.'].filter(Boolean);
}
export function formatDate(value, hour12 = false) {
  if (!value) return '—';
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '—';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12 }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}/${parts.month}/${parts.day} - ${parts.hour}:${parts.minute}${hour12 ? ' ' + parts.dayPeriod.toUpperCase() : ''}`;
}
export const pageItems = value => Array.isArray(value) ? value : value?.content || [];

export function mergeConversationPage(previous, rows, append = false, retainHistory = false) {
  const retained = previous.filter(message => !rows.some(row => row.id === message.id));
  return append ? [...rows, ...retained] : retainHistory ? [...retained, ...rows] : rows;
}

export function notificationText(content) {
  return ({ 'Where are you?': 'وينك؟', 'I am on my way': 'أنا في الطريق', 'I have arrived': 'وصلت!', 'You have a new message': 'وصلتك رسالة جديدة' })[content] || content;
}

export function datetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
