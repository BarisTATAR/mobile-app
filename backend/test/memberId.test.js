const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMemberId, isValidMemberIdFormat, formatUserForClient, normalizeUserLanguage } = require('../utils/memberId');

test('normalizeMemberId uppercases and strips junk', () => {
  assert.equal(normalizeMemberId(' 48ab cd '), '48ABCD');
});

test('isValidMemberIdFormat requires 48 + 6 alphanumerics', () => {
  assert.equal(isValidMemberIdFormat('48X7K9M2'), true);
  assert.equal(isValidMemberIdFormat('48ABC'), false);
  assert.equal(isValidMemberIdFormat('99ABCDEF'), false);
});

test('user language is locked to tr or en and returned to the client', () => {
  assert.equal(normalizeUserLanguage('en'), 'en');
  assert.equal(normalizeUserLanguage('tr'), 'tr');
  assert.equal(normalizeUserLanguage('de'), 'tr');
  const user = formatUserForClient({
    _id: '1',
    username: 'ali',
    name: 'Ali',
    surname: 'Yilmaz',
    language: 'en',
    address: {},
  });
  assert.equal(user.language, 'en');
});
