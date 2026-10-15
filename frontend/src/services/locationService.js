import { api } from '../api.js';
import { shouldPublish, validCoordinates } from '../utils/navigationCalculations.js';

// A single uploader survives watch restarts: no overlapping writes or delayed GPS queue.
export function createLocationPublisher(save, clock = Date.now) {
  let pending = false, last = null, attemptedAt = -Infinity, sentAt = -Infinity;
  return {
    async publish(point, interval) {
      const now = clock();
      const activityDue = validCoordinates(point) && now - sentAt >= 30000;
      if (pending || now - attemptedAt < Math.min(interval, 30000) || (!activityDue && !shouldPublish(point, last, now - sentAt, interval))) return false;
      pending = true; attemptedAt = now;
      try { await save(point); last = point; sentAt = now; return true; }
      finally { pending = false; }
    }
  };
}
export async function optionalMeeting(id) {
  try { return await api.meeting(id); }
  catch (error) { if (error.message === 'This group has no meeting point yet') return null; throw error; }
}
