import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordIssues, formatDate, datetimeLocalValue, notificationText, mergeConversationPage } from '../src/utils.js';
test('password feedback identifies the particular missing condition', () => { assert.deepEqual(passwordIssues('Password!'), ['أضف رقمًا واحدًا على الأقل']); assert.deepEqual(passwordIssues('Password1!'), []); assert.equal(passwordIssues('').length, 5); });

test('password validation matches backend Unicode symbols and the 72-byte UTF-8 limit', () => {
 assert.deepEqual(passwordIssues('Password1ع'), ['أضف رمزًا واحدًا على الأقل']);
 assert.deepEqual(passwordIssues('Password1؛'), []);
 assert.deepEqual(passwordIssues('Aa1!' + 'ع'.repeat(34)), []);
 assert.deepEqual(passwordIssues('Aa1!' + 'ع'.repeat(35)), ['الباسوورد طويل جدًا. استخدم أحرفًا أقل.']);
});
test('date format uses Riyadh time and the selected 12 or 24-hour clock', () => { assert.equal(formatDate('2026-11-11T18:00:00Z', false), '2026/11/11 - 21:00'); assert.equal(formatDate('2026-11-11T18:00:00Z', true), '2026/11/11 - 09:00 PM'); });

test('scheduled sharing dates round-trip through a local datetime field without shifting the instant', () => {
 const instant = '2026-11-11T18:30:00.000Z';
 assert.equal(new Date(datetimeLocalValue(instant)).toISOString(), instant);
 assert.equal(datetimeLocalValue(null), ''); assert.equal(datetimeLocalValue('invalid'), '');
});

test('only known system notifications are translated; custom content is preserved', () => {
 assert.equal(notificationText('I have arrived'), 'وصلت!');
 assert.equal(notificationText('A custom English message'), 'A custom English message');
});

test('polling keeps earlier loaded pages and updates message read receipts without duplication', () => {
 const previous = [{ id: 1 }, { id: 2 }, { id: 3, readAt: null }];
 const rows = [{ id: 3, readAt: 'read' }, { id: 4 }];
 assert.deepEqual(mergeConversationPage(previous, rows, false, true), [{ id: 1 }, { id: 2 }, ...rows]);
 assert.deepEqual(mergeConversationPage([{ id: 3 }], [{ id: 1 }, { id: 2 }, { id: 3 }], true), [{ id: 1 }, { id: 2 }, { id: 3 }]);
 assert.deepEqual(mergeConversationPage(previous, [{ id: 9 }]), [{ id: 9 }]);
});
