const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDateStr,
  isDateManuallyClosed,
  isSlotAllowedForBusiness,
  getReservationSlotsForBusiness,
} = require('../utils/reservationSlots');

test('normalizeDateStr keeps YYYY-MM-DD', () => {
  assert.equal(normalizeDateStr('2026-09-23'), '2026-09-23');
  assert.equal(normalizeDateStr('23/09/2026'), '');
});

test('isDateManuallyClosed matches listed dates', () => {
  const business = { reservationClosedDates: ['2026-09-23'] };
  assert.equal(isDateManuallyClosed(business, '2026-09-23'), true);
  assert.equal(isDateManuallyClosed(business, '2026-09-24'), false);
});

test('slots follow weekday opening hours', () => {
  const business = {
    activityField: 'restorant',
    openingHours: { weekdays: { open: '10:00', close: '11:00' }, weekend: { open: 'kapalı', close: '' } },
  };
  const slots = getReservationSlotsForBusiness(business, '2026-09-23');
  assert.ok(slots.includes('10:00'));
  assert.ok(slots.includes('10:30'));
  assert.equal(isSlotAllowedForBusiness(business, '2026-09-23', '10:00'), true);
  assert.equal(isSlotAllowedForBusiness(business, '2026-09-23', '12:00'), false);
});

test('manually closed date has no slots', () => {
  const business = {
    activityField: 'restorant',
    reservationClosedDates: ['2026-09-23'],
    openingHours: { weekdays: { open: '10:00', close: '22:00' } },
  };
  assert.deepEqual(getReservationSlotsForBusiness(business, '2026-09-23'), []);
});
