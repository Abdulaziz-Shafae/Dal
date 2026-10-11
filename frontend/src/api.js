const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let csrf = null;
let csrfPending = null;
export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
async function parseResponse(response) {
  const text = await response.text();
  let result; try { result = text ? JSON.parse(text) : null; } catch { throw new ApiError('تعذر الاتصال بالخدمة. تحقق من إعداد رابط الباك إند.', response.status); }
  if (!response.ok) throw new ApiError(result?.message || 'تعذر إكمال الطلب', response.status);
  return result;
}
export async function getCsrfToken(force = false) {
  if (force) csrf = null;
  if (csrf) return csrf;
  if (!csrfPending) csrfPending = fetch(`${base}/api/v1/security/csrf`, { credentials: 'include', cache: 'no-store' }).then(parseResponse).then(value => { csrf = value; return value; }).finally(() => { csrfPending = null; });
  return csrfPending;
}
export async function requestApi(path, method = 'GET', body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method)) { const token = await getCsrfToken(); headers[token.headerName] = token.token; }
  let response;
  try { response = await fetch(`${base}/api/v1${path}`, { method, headers, credentials: 'include', cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new ApiError('تعذر الاتصال. تحقق من اتصال الإنترنت وحاول مجددًا.', 0); }
  let result;
  try { result = await parseResponse(response); } catch (error) { if (error.status === 403 && /CSRF/.test(error.message)) csrf = null; throw error; }
  if (['/user/login', '/user/logout', '/password-reset/confirm'].includes(path)) csrf = null;
  return result;
}
export const api = {
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
