import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordIssues, formatDate } from '../src/utils.js';
test('password feedback identifies the particular missing condition', () => { assert.deepEqual(passwordIssues('Password!'), ['أضف رقمًا واحدًا على الأقل']); assert.deepEqual(passwordIssues('Password1!'), []); assert.equal(passwordIssues('').length, 5); });
test('date format uses Riyadh time and the selected 12 or 24-hour clock', () => { assert.equal(formatDate('2026-11-11T18:00:00Z', false), '2026/11/11 - 21:00'); assert.equal(formatDate('2026-11-11T18:00:00Z', true), '2026/11/11 - 09:00 PM'); });
