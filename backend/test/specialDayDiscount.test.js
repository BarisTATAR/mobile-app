const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTrDate,
  parseMonthDay,
  isTodayUsersSpecialDay,
} = require('../utils/specialDayDiscount');

test('normalizeTrDate accepts slash, dot and ISO', () => {
  assert.equal(normalizeTrDate('23/09/1990'), '23/09/1990');
  assert.equal(normalizeTrDate('23.09.1990'), '23/09/1990');
  assert.equal(normalizeTrDate('1990-09-23'), '23/09/1990');
});

test('normalizeTrDate rejects invalid calendar dates', () => {
  assert.equal(normalizeTrDate('31/02/2020'), null);
  assert.equal(normalizeTrDate(''), null);
  assert.equal(normalizeTrDate('abc'), null);
});

test('parseMonthDay reads day/month from stored slash date', () => {
  assert.deepEqual(parseMonthDay('23/09/1990'), { month: 9, day: 23 });
});

test('isTodayUsersSpecialDay matches month and day', () => {
  const ref = new Date(2026, 8, 23);
  assert.equal(isTodayUsersSpecialDay('23/09/1990', ref), true);
  assert.equal(isTodayUsersSpecialDay('24/09/1990', ref), false);
});
