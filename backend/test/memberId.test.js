const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMemberId, isValidMemberIdFormat } = require('../utils/memberId');

test('normalizeMemberId uppercases and strips junk', () => {
  assert.equal(normalizeMemberId(' 48ab cd '), '48ABCD');
});

test('isValidMemberIdFormat requires 48 + 6 alphanumerics', () => {
  assert.equal(isValidMemberIdFormat('48X7K9M2'), true);
  assert.equal(isValidMemberIdFormat('48ABC'), false);
  assert.equal(isValidMemberIdFormat('99ABCDEF'), false);
});
