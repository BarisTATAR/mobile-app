const { test } = require('node:test');
const assert = require('node:assert/strict');
const { foldTr, filterByDistrict, resolveCityAndDistrict } = require('../utils/onDutyPharmacies');

test('foldTr maps Turkish letters for matching', () => {
  assert.equal(foldTr('FETHİYE'), foldTr('Fethiye'));
  assert.equal(foldTr('Menteşe'), foldTr('MENTESE'));
  assert.equal(foldTr('Muğla'), 'mugla');
  assert.equal(foldTr('  Fethiye  '), 'fethiye');
});

test('filterByDistrict keeps only matching district ignoring accents', () => {
  const list = [
    { name: 'A', district: 'FETHİYE' },
    { name: 'B', district: 'BODRUM' },
  ];
  const out = filterByDistrict(list, 'Fethiye');
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'A');
});

test('filterByDistrict returns all when district empty', () => {
  const list = [{ district: 'BODRUM' }];
  assert.equal(filterByDistrict(list, '').length, 1);
});

test('filterByDistrict maps Menteşe to MERKEZ', () => {
  const list = [
    { name: 'A', district: 'MERKEZ' },
    { name: 'B', district: 'BODRUM' },
  ];
  const out = filterByDistrict(list, 'Menteşe');
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'A');
});

test('filterByDistrict matches Fethiye Merkez to FETHİYE', () => {
  const list = [{ name: 'A', district: 'FETHİYE' }];
  const out = filterByDistrict(list, 'Fethiye Merkez');
  assert.equal(out.length, 1);
});

test('resolveCityAndDistrict treats a Muğla district as city=MUGLA', () => {
  const out = resolveCityAndDistrict('Fethiye', '');
  assert.equal(out.city, 'Muğla');
  assert.equal(out.district, 'Fethiye');
});

test('resolveCityAndDistrict strips province suffix', () => {
  const out = resolveCityAndDistrict('Muğla Province', 'Ortaca');
  assert.equal(out.city, 'Muğla');
  assert.equal(out.district, 'Ortaca');
});
