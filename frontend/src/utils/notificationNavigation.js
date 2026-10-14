export class NotificationNavigationError extends Error {}

export function notificationDestination(notification) {
  if (!Number.isInteger(notification?.groupId) || notification.groupId <= 0) {
    throw new NotificationNavigationError('لا توجد مجموعة صالحة مرتبطة بهذا التنبيه.');
  }
  const groupId = notification.groupId;
  if (notification.type === 'MESSAGE' && notification.content === 'You have a new group message') {
    return { view: 'chat', chatTab: 'group', groupId, memberId: null };
  }
  const privateMessage = notification.type === 'MESSAGE' && notification.content === 'You have a new message';
  if (!privateMessage && !['NUDGE', 'ARRIVED'].includes(notification.type)) {
    throw new NotificationNavigationError('لا تتوفر وجهة معروفة لهذا النوع من التنبيهات.');
  }
  if (!Number.isInteger(notification.senderId) || notification.senderId <= 0) {
    throw new NotificationNavigationError('لا يوجد عضو صالح مرتبط بهذا التنبيه.');
  }
  return { view: privateMessage ? 'chat' : 'map', chatTab: 'private', groupId, memberId: notification.senderId };
}

export async function loadNotificationDestination(notification, api, userId) {
  const destination = notificationDestination(notification);
  try {
    // Load the referenced group, not the group currently open in the interface.
    const group = await api.group(destination.groupId);
    if (group?.id !== destination.groupId) throw new NotificationNavigationError('المجموعة المرتبطة بالتنبيه لم تعد متاحة.');
    const [members, sharing, meeting] = await Promise.all([
      api.members(group.id), api.groupSharing(group.id),
      api.meeting(group.id).catch(error => { if (error.message === 'This group has no meeting point yet') return null; throw error; })
    ]);
    if (!Array.isArray(members)) throw new NotificationNavigationError('تعذر التحقق من أعضاء المجموعة المرتبطة بالتنبيه.');
    const selected = destination.memberId === null ? null : members.find(member => member.userId === destination.memberId);
    if (destination.memberId !== null && (!selected || selected.userId === userId)) {
      throw new NotificationNavigationError('العضو المرتبط بالتنبيه لم يعد ضمن المجموعة أو لم يعد متاحًا.');
    }
    const requests = ['OWNER', 'ADMIN'].includes(group.myRole) ? await api.groupRequests(group.id) : [];
    return { ...destination, group, members, sharing, meeting, selected, requests };
  } catch (error) {
    if (error instanceof NotificationNavigationError || error.status === 401) throw error;
    if ([400, 403, 404, 410].includes(error.status)) {
      throw new NotificationNavigationError('المحتوى المرتبط بالتنبيه لم يعد متاحًا أو ليس لديك صلاحية الوصول إليه.');
    }
    throw new NotificationNavigationError('تعذر فتح المحتوى المرتبط بالتنبيه. تحقق من الاتصال وحاول مجددًا.');
  }
}
