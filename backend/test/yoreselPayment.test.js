const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeYoreselReservationFee,
  parseYoreselReservationFeeInput,
  formatFeeTry,
  serializeAppSettings,
} = require('../utils/yoreselPayment');

test('normalizeYoreselReservationFee treats empty and negative as 0', () => {
  assert.equal(normalizeYoreselReservationFee(null), 0);
  assert.equal(normalizeYoreselReservationFee(-5), 0);
  assert.equal(normalizeYoreselReservationFee('abc'), 0);
  assert.equal(normalizeYoreselReservationFee(150.456), 150.46);
});

test('parseYoreselReservationFeeInput accepts comma decimals', () => {
  assert.equal(parseYoreselReservationFeeInput('150,5'), 150.5);
  assert.equal(parseYoreselReservationFeeInput(''), 0);
  assert.throws(() => parseYoreselReservationFeeInput('x'), /Geçersiz/);
});

test('formatFeeTry uses TL label', () => {
  assert.equal(formatFeeTry(0), '0 TL');
  assert.equal(formatFeeTry(200), '200 TL');
  assert.equal(formatFeeTry(12.5), '12,50 TL');
});

test('serializeAppSettings includes fee without wiping photo', () => {
  const out = serializeAppSettings({ homeImageUrl: '/img.jpg', yoreselReservationFee: 80 }, true);
  assert.equal(out.homeImageUrl, '/img.jpg');
  assert.equal(out.yoreselReservationFee, 80);
  assert.equal(out.yoreselPaymentConfigured, true);
});
