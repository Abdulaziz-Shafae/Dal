import { distanceBetween, locationAge, locationVisible, validCoordinates } from './navigationCalculations.js';

// The Compass freshness threshold is 30 seconds. Membership and explicit
// sharing consent are required even when a location row supplies coordinates.
export function nearestGroupMember({ own, rows, members, userId, groupId, now = Date.now() }) {
  if (!validCoordinates(own) || locationAge(own, now) > 30000) return null;
  let nearest = null;
  for (const member of members) {
    if (member.userId == null || member.userId === userId || (member.groupId != null && member.groupId !== groupId)) continue;
    const point = rows.find(row => row.userId === member.userId);
    if (!locationVisible(point, now) || locationAge(point, now) > 30000 || (point.groupId != null && point.groupId !== groupId)) continue;
    const distanceMeters = distanceBetween(own, point);
    if (!nearest || distanceMeters < nearest.distanceMeters) nearest = { member, distanceMeters };
  }
  return nearest;
}
