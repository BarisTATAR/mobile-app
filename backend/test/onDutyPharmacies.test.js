const { test } = require('node:test');
const assert = require('node:assert/strict');
const { foldTr, filterByDistrict } = require('../utils/onDutyPharmacies');

test('foldTr maps Turkish letters for matching', () => {
  assert.equal(foldTr('FETHİYE'), foldTr('Fethiye'));
  assert.equal(foldTr('Menteşe'), foldTr('MENTESE'));
  assert.equal(foldTr('Muğla'), 'mugla');
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
