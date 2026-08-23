const crypto = require('crypto');
const User = require('../models/User');

const MEMBER_ID_PREFIX = '48';
const MEMBER_ID_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXY';

function normalizeMemberId(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

function isValidMemberIdFormat(id) {
  const s = normalizeMemberId(id);
  return /^48[0-9A-Z]{6}$/.test(s);
}

async function generateUniqueMemberId() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
      suffix += MEMBER_ID_CHARS[crypto.randomInt(0, MEMBER_ID_CHARS.length)];
    }
    const candidate = `${MEMBER_ID_PREFIX}${suffix}`;
    const exists = await User.findOne({ memberId: candidate }).select('_id').lean();
    if (!exists) return candidate;
  }
  throw new Error('Benzersiz üye numarası üretilemedi');
}

async function ensureUserMemberId(userDoc) {
  if (!userDoc) return '';
  if (userDoc.memberId && isValidMemberIdFormat(userDoc.memberId)) {
    return normalizeMemberId(userDoc.memberId);
  }
  userDoc.memberId = await generateUniqueMemberId();
  await userDoc.save();
  return userDoc.memberId;
}

function formatUserForClient(userDoc) {
  if (!userDoc) return null;
  return {
    id: userDoc._id,
    memberId: userDoc.memberId ? normalizeMemberId(userDoc.memberId) : '',
    username: userDoc.username,
    name: userDoc.name,
    surname: userDoc.surname,
    phone: userDoc.phone || '',
    address: {
      city: userDoc.address?.city != null ? String(userDoc.address.city).trim() : '',
      district: userDoc.address?.district != null ? String(userDoc.address.district).trim() : '',
      neighborhood: userDoc.address?.neighborhood != null ? String(userDoc.address.neighborhood).trim() : '',
    },
  };
}

module.exports = {
  normalizeMemberId,
  isValidMemberIdFormat,
  generateUniqueMemberId,
  ensureUserMemberId,
  formatUserForClient,
};
