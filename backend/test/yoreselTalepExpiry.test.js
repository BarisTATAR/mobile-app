const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isYoreselPendingTimedOut,
  YORESEL_PENDING_TIMEOUT_MS,
} = require('../utils/yoreselTalepExpiry');

test('pending timeout is 72 hours', () => {
  assert.equal(YORESEL_PENDING_TIMEOUT_MS, 72 * 60 * 60 * 1000);
});

test('isYoreselPendingTimedOut is false under 72 hours', () => {
  const createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000);
  assert.equal(isYoreselPendingTimedOut({ createdAt, manualEntry: false }), false);
});

test('isYoreselPendingTimedOut is true at 72 hours', () => {
  const createdAt = new Date(Date.now() - 72 * 60 * 60 * 1000);
  assert.equal(isYoreselPendingTimedOut({ createdAt, manualEntry: false }), true);
});

test('manual entries are never timed out', () => {
  const createdAt = new Date(Date.now() - 80 * 60 * 60 * 1000);
  assert.equal(isYoreselPendingTimedOut({ createdAt, manualEntry: true }), false);
});
