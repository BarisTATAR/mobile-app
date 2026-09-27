const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  kvkkConsentAccepted,
  wouldExceedLimit,
  BUSINESS_ACTIVE_RESERVATION_LIMIT,
  BUSINESS_DAILY_PER_ACTIVITY_LIMIT,
  YORESEL_DAILY_RESERVATION_LIMIT,
  YORESEL_PERIOD_RESERVATION_LIMIT,
  businessActivityDailyLimitMessage,
  countUserActiveReservations,
  countUserReservationsForActivityOnDate,
  countYoreselUserReservationsToday,
  countYoreselUserReservationsLastDays,
  isObjectIdLike,
} = require('../utils/reservationLimits');

test('KVKK requires both phone and location consent', () => {
  assert.equal(kvkkConsentAccepted({ phoneShare: true, location: true }), true);
  assert.equal(kvkkConsentAccepted({ phoneShare: true, location: false }), false);
  assert.equal(kvkkConsentAccepted({ phoneShare: false, location: true }), false);
  assert.equal(kvkkConsentAccepted({}), false);
  assert.equal(kvkkConsentAccepted({ phoneShare: 'true', location: 'true' }), true);
});

test('active reservation cap is 5 pending or approved', () => {
  assert.equal(wouldExceedLimit(4, BUSINESS_ACTIVE_RESERVATION_LIMIT), false);
  assert.equal(wouldExceedLimit(5, BUSINESS_ACTIVE_RESERVATION_LIMIT), true);
});

test('activity daily cap is 2', () => {
  assert.equal(wouldExceedLimit(1, BUSINESS_DAILY_PER_ACTIVITY_LIMIT), false);
  assert.equal(wouldExceedLimit(2, BUSINESS_DAILY_PER_ACTIVITY_LIMIT), true);
  assert.match(businessActivityDailyLimitMessage('restorant'), /Restoran/);
});

test('yoresel caps are 2 per day and 3 per 30 days', () => {
  assert.equal(wouldExceedLimit(2, YORESEL_DAILY_RESERVATION_LIMIT), true);
  assert.equal(wouldExceedLimit(3, YORESEL_PERIOD_RESERVATION_LIMIT), true);
});

test('isObjectIdLike accepts 24-hex ids only', () => {
  assert.equal(isObjectIdLike('64b1f0c2a1b2c3d4e5f60789'), true);
  assert.equal(isObjectIdLike('not-an-id'), false);
});

test('countUserActiveReservations queries pending and approved', async () => {
  const calls = [];
  const Reservation = {
    countDocuments: async (q) => {
      calls.push(q);
      return 5;
    },
  };
  const n = await countUserActiveReservations(Reservation, 'u1');
  assert.equal(n, 5);
  assert.deepEqual(calls[0].status.$in, ['pending', 'approved']);
});

test('activity day count excludes rejected reservations', async () => {
  const models = {
    Business: {
      find: () => ({
        select: () => ({
          lean: async () => [{ _id: 'b1' }],
        }),
      }),
    },
    Reservation: {
      countDocuments: async (q) => {
        assert.deepEqual(q.status, { $ne: 'rejected' });
        assert.equal(q.date, '2026-09-23');
        return 2;
      },
    },
  };
  const n = await countUserReservationsForActivityOnDate(models, 'u1', 'restorant', '2026-09-23');
  assert.equal(n, 2);
});

test('yoresel 30-day count includes cancelled because status is not filtered', async () => {
  const seen = [];
  const Model = {
    countDocuments: async (q) => {
      seen.push(q);
      return 3;
    },
  };
  const n = await countYoreselUserReservationsLastDays(Model, '64b1f0c2a1b2c3d4e5f60789', 30);
  assert.equal(n, 3);
  assert.equal(seen[0].status, undefined);
});

test('yoresel today count includes cancelled because status is not filtered', async () => {
  const seen = [];
  const Model = {
    countDocuments: async (q) => {
      seen.push(q);
      return 1;
    },
  };
  const n = await countYoreselUserReservationsToday(Model, '64b1f0c2a1b2c3d4e5f60789');
  assert.equal(n, 1);
  assert.equal(seen[0].status, undefined);
  assert.deepEqual(seen[0].manualEntry, { $ne: true });
});
