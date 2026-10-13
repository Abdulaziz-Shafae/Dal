const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let csrf = null;
let csrfPending = null;
export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
async function fetchParsed(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try { return await parseResponse(await fetch(url, { ...options, signal: controller.signal })); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('تعذر الاتصال. تحقق من اتصال الإنترنت وحاول مجددًا.', 0); }
  finally { clearTimeout(timeout); }
}
async function parseResponse(response) {
  const text = await response.text();
  let result; try { result = text ? JSON.parse(text) : null; } catch { throw new ApiError(response.status === 403 && text.trim() === 'Invalid CORS request' ? 'عنوان الواجهة غير مسموح له بالاتصال بالخدمة. يرجى مراجعة إعدادات الاتصال.' : 'تعذر الاتصال بالخدمة. تحقق من إعداد رابط الباك إند.', response.status); }
  if (!response.ok && ['Please log in first', 'Your session has expired. Please log in again'].includes(result?.message)) { csrf = null; throw new ApiError('انتهت الجلسة. سجّل دخولك من جديد.', 401); }
  const translatedErrors = { 'Invalid email or password': 'الإيميل أو الباسوورد غير صحيح.', 'Email is already registered': 'هذا الإيميل مسجل بالفعل. جرّب تسجيل الدخول.', 'Invalid group join code': 'كود المجموعة غير صحيح. تحقق منه وحاول مجددًا.', 'This join code is no longer valid': 'كود المجموعة لم يعد صالحًا. اطلب الكود الجديد من المالك.', 'You are already a member of this group': 'أنت عضو في هذه المجموعة بالفعل.', 'You already have a pending request for this group': 'طلب انضمامك لهذه المجموعة بانتظار الموافقة.', 'Invalid or expired password reset link': 'رابط تغيير الباسوورد غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.', 'Password reset page URL is not configured': 'خدمة استعادة الباسوورد غير مهيأة حاليًا. حاول لاحقًا.' };
  if (!response.ok) throw new ApiError(translatedErrors[result?.message] || result?.message || 'تعذر إكمال الطلب', response.status);
  return result;
}
export async function getCsrfToken(force = false) {
  if (force) csrf = null;
  if (csrf) return csrf;
  if (!csrfPending) csrfPending = fetchParsed(`${base}/api/v1/security/csrf`, { credentials: 'include', cache: 'no-store' }).then(value => { csrf = value; return value; }).finally(() => { csrfPending = null; });
  return csrfPending;
}
export async function requestApi(path, method = 'GET', body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method)) { const token = await getCsrfToken(); headers[token.headerName] = token.token; }
  let result;
  try { result = await fetchParsed(`${base}/api/v1${path}`, { method, headers, credentials: 'include', cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); } catch (error) { if (error.status === 403 && /CSRF/.test(error.message)) csrf = null; throw error; }
  if (['/user/login', '/user/logout', '/password-reset/confirm'].includes(path)) csrf = null;
  return result;
}
export const api = {
  walkingRoute: (id, input) => requestApi(`/navigation/group/${id}/walking`, 'POST', input),
  reunionAssistance: (id, input) => requestApi(`/navigation/group/${id}/reunion-assistance`, 'POST', input),
  meetingSuggestions: (id, input) => requestApi(`/navigation/group/${id}/meeting-suggestions`, 'POST', input),
  unreadNotifications: () => requestApi('/notification/unread-count'),
  groupConversation: (id, page = 0) => requestApi(`/group-message/group/${id}?page=${page}&size=20`),
  sendGroupMessage: (id, input) => requestApi(`/group-message/group/${id}`, 'POST', input),
  readGroupMessages: (id, message) => requestApi(`/group-message/group/${id}/read/${message}`, 'PUT'),
  groupUnread: id => requestApi(`/group-message/group/${id}/unread-count`),
  register: input => requestApi('/user/register', 'POST', input), login: input => requestApi('/user/login', 'POST', input), logout: () => requestApi('/user/logout', 'POST'), profile: () => requestApi('/user/profile'), updateProfile: input => requestApi('/user/profile', 'PUT', input),
  resetRequest: email => requestApi('/password-reset/request', 'POST', { email }), resetConfirm: input => requestApi('/password-reset/confirm', 'POST', input),
  groups: () => requestApi('/group/my'), group: id => requestApi(`/group/${id}`), createGroup: input => requestApi('/group/create', 'POST', input), updateGroup: (id, input) => requestApi(`/group/${id}`, 'PUT', input), join: joinCode => requestApi('/group/join', 'POST', { joinCode }), pauseGroup: id => requestApi(`/group/${id}/pause`, 'PUT', {}), resumeGroup: id => requestApi(`/group/${id}/resume`, 'PUT'), closeGroup: id => requestApi(`/group/${id}/close`, 'PUT'), regenerateCode: id => requestApi(`/group/${id}/join-code`, 'PUT'), transferOwner: (id, member) => requestApi(`/group/${id}/owner/${member}`, 'PUT'),
  members: id => requestApi(`/group-member/group/${id}`), leave: id => requestApi(`/group-member/group/${id}/leave`, 'DELETE'), role: (id, role) => requestApi(`/group-member/${id}/role`, 'PUT', { role }), remove: id => requestApi(`/group-member/${id}`, 'DELETE'),
  requests: () => requestApi('/join-request/my'), groupRequests: id => requestApi(`/join-request/group/${id}?status=PENDING`), approve: id => requestApi(`/join-request/${id}/approve`, 'PUT'), reject: id => requestApi(`/join-request/${id}/reject`, 'PUT'), cancelRequest: id => requestApi(`/join-request/${id}`, 'DELETE'),
  sharing: () => requestApi('/sharing'), updateSharing: input => requestApi('/sharing', 'PUT', input), pauseAll: () => requestApi('/sharing/pause', 'PUT', {}), resumeAll: () => requestApi('/sharing/resume', 'PUT'), groupSharing: id => requestApi(`/sharing/group/${id}`), pauseSharing: id => requestApi(`/sharing/group/${id}/pause`, 'PUT', {}), resumeSharing: id => requestApi(`/sharing/group/${id}/resume`, 'PUT'),
  locations: id => requestApi(`/location/group/${id}`), myLocation: () => requestApi('/location/my'), saveLocation: input => requestApi('/location/update', 'POST', input), deleteHistory: () => requestApi('/location/my/history', 'DELETE'),
  meeting: id => requestApi(`/meeting-point/group/${id}`), setMeeting: (id, input) => requestApi(`/meeting-point/group/${id}`, 'PUT', input), deleteMeeting: id => requestApi(`/meeting-point/group/${id}`, 'DELETE'),
  conversation: (id, user, page = 0) => requestApi(`/message/group/${id}/with/${user}?page=${page}&size=20`), send: (id, user, input) => requestApi(`/message/group/${id}/to/${user}`, 'POST', input), readMessage: id => requestApi(`/message/${id}/read`, 'PUT'),
  notifications: () => requestApi('/notification/my?page=0&size=20'), readNotification: id => requestApi(`/notification/${id}/read`, 'PUT'), nudge: (id, user, message) => requestApi(`/notification/group/${id}/nudge/${user}`, 'POST', { message }), arrived: (id, user) => requestApi(`/reunion/group/${id}/arrived/${user}`, 'POST')
};
