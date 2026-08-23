const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const PREMIUM_OWNER_TYPES = ['isletme', 'esnaf', 'cekici', 'lastikci', 'taksi', 'yoresel_etkinlik'];

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phoneDigitsOnly(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function phoneDigitsMatch(a, b) {
  const da = phoneDigitsOnly(a);
  const db = phoneDigitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const na = da.replace(/^0+/, '');
  const nb = db.replace(/^0+/, '');
  return na.length > 0 && na === nb;
}

async function findListingPremiumForLogin(Model, nameField, loginKey) {
  const key = String(loginKey || '').trim();
  if (!key) return null;
  const query = { premium: true, password: { $exists: true, $ne: '' } };
  const rx = new RegExp(`^${escapeRegExp(key)}$`, 'i');
  const byName = await Model.findOne({ ...query, [nameField]: rx }).lean();
  if (byName) return byName;

  const digits = phoneDigitsOnly(key);
  if (!digits) return null;

  const candidates = await Model.find({ ...query, phone: { $exists: true, $ne: '' } }).lean();
  const matches = candidates.filter((c) => phoneDigitsMatch(c.phone, digits));
  if (matches.length === 1) return matches[0];
  return null;
}

function ownerMetaFromDoc(ownerType, doc) {
  if (!doc) return { displayName: '', phone: '', address: {} };
  switch (ownerType) {
    case 'isletme':
      return {
        displayName: String(doc.businessName || '').trim(),
        phone: String(doc.phone || '').trim(),
        address: doc.address || {},
      };
    case 'esnaf':
      return {
        displayName: String(doc.name || '').trim(),
        phone: String(doc.phone || '').trim(),
        address: doc.address || {},
      };
    case 'cekici':
    case 'taksi':
      return {
        displayName: String(doc.companyName || '').trim(),
        phone: String(doc.phone || '').trim(),
        address: doc.address || {},
      };
    case 'lastikci':
      return {
        displayName: String(doc.name || '').trim(),
        phone: String(doc.phone || '').trim(),
        address: doc.address || {},
      };
    case 'yoresel_etkinlik':
      return {
        displayName: String(doc.loginName || doc.name || '').trim(),
        phone: String(doc.phone || '').trim(),
        address: doc.address || {},
        loginGroupId: String(doc.loginGroupId || '').trim(),
      };
    default:
      return { displayName: '', phone: '', address: {} };
  }
}

function buildPremiumOwnerConfig(models) {
  const { Business, Esnaf, Cekici, Lastikci, Taksi, YoreselEtkinlikIsletme } = models;
  return {
    isletme: {
      Model: Business,
      nameField: 'businessName',
      async findForLogin(loginKey) {
        const key = String(loginKey || '').trim();
        if (!key) return null;
        return Business.findOne({
          businessName: { $regex: new RegExp(`^${escapeRegExp(key)}$`, 'i') },
          approved: true,
          premium: true,
        }).lean();
      },
      async verifyAccess(ownerId, loginKey) {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;
        const doc = await Business.findById(ownerId).lean();
        if (!doc || doc.approved !== true) return null;
        const key = String(loginKey || '').trim();
        if (key && !new RegExp(`^${escapeRegExp(key)}$`, 'i').test(String(doc.businessName || ''))) {
          return null;
        }
        return doc;
      },
    },
    esnaf: {
      Model: Esnaf,
      nameField: 'name',
      async findForLogin(loginKey) {
        return findListingPremiumForLogin(Esnaf, 'name', loginKey);
      },
      async verifyAccess(ownerId, loginKey) {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;
        const doc = await Esnaf.findById(ownerId).lean();
        if (!doc || doc.premium !== true) return null;
        const key = String(loginKey || '').trim();
        if (!key) return doc;
        if (phoneDigitsMatch(doc.phone, key)) return doc;
        if (new RegExp(`^${escapeRegExp(key)}$`, 'i').test(String(doc.name || ''))) return doc;
        return null;
      },
    },
    cekici: {
      Model: Cekici,
      nameField: 'companyName',
      async findForLogin(loginKey) {
        return findListingPremiumForLogin(Cekici, 'companyName', loginKey);
      },
      async verifyAccess(ownerId, loginKey) {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;
        const doc = await Cekici.findById(ownerId).lean();
        if (!doc || doc.premium !== true) return null;
        const key = String(loginKey || '').trim();
        if (!key) return doc;
        if (phoneDigitsMatch(doc.phone, key)) return doc;
        if (new RegExp(`^${escapeRegExp(key)}$`, 'i').test(String(doc.companyName || ''))) return doc;
        return null;
      },
    },
    lastikci: {
      Model: Lastikci,
      nameField: 'name',
      async findForLogin(loginKey) {
        return findListingPremiumForLogin(Lastikci, 'name', loginKey);
      },
      async verifyAccess(ownerId, loginKey) {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;
        const doc = await Lastikci.findById(ownerId).lean();
        if (!doc || doc.premium !== true) return null;
        const key = String(loginKey || '').trim();
        if (!key) return doc;
        if (phoneDigitsMatch(doc.phone, key)) return doc;
        if (new RegExp(`^${escapeRegExp(key)}$`, 'i').test(String(doc.name || ''))) return doc;
        return null;
      },
    },
    taksi: {
      Model: Taksi,
      nameField: 'companyName',
      async findForLogin(loginKey) {
        return findListingPremiumForLogin(Taksi, 'companyName', loginKey);
      },
      async verifyAccess(ownerId, loginKey) {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;
        const doc = await Taksi.findById(ownerId).lean();
        if (!doc || doc.premium !== true) return null;
        const key = String(loginKey || '').trim();
        if (!key) return doc;
        if (phoneDigitsMatch(doc.phone, key)) return doc;
        if (new RegExp(`^${escapeRegExp(key)}$`, 'i').test(String(doc.companyName || ''))) return doc;
        return null;
      },
    },
    yoresel_etkinlik: {
      Model: YoreselEtkinlikIsletme,
      nameField: 'loginName',
      async findForLogin(loginKey) {
        const key = String(loginKey || '').trim();
        if (!key) return null;
        const rx = new RegExp(`^${escapeRegExp(key)}$`, 'i');
        return YoreselEtkinlikIsletme.findOne({
          active: true,
          premium: true,
          $or: [
            { loginName: rx },
            { $and: [{ $or: [{ loginName: '' }, { loginName: { $exists: false } }] }, { name: rx }] },
          ],
        }).lean();
      },
      async verifyAccess(ownerId, loginKey) {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;
        const doc = await YoreselEtkinlikIsletme.findById(ownerId).lean();
        if (!doc || doc.active === false) return null;
        const key = String(loginKey || '').trim();
        if (!key) return doc;
        const ln = String(doc.loginName || '').trim();
        const nm = String(doc.name || '').trim();
        if (ln && new RegExp(`^${escapeRegExp(key)}$`, 'i').test(ln)) return doc;
        if (!ln && nm && new RegExp(`^${escapeRegExp(key)}$`, 'i').test(nm)) return doc;
        return null;
      },
    },
  };
}

async function premiumOwnerContentQuery(ownerType, ownerDoc) {
  const oid = ownerDoc._id;
  const clauses = [{ premiumOwnerType: ownerType, premiumOwnerId: oid }];
  if (ownerType === 'yoresel_etkinlik') {
    const gid = String(ownerDoc.loginGroupId || '').trim();
    if (gid) {
      clauses.push({ premiumOwnerType: ownerType, premiumOwnerGroupId: gid });
    }
  }
  return { $or: clauses };
}

function premiumOwnerIdsForCreate(ownerType, ownerDoc) {
  const out = {
    premiumOwnerType: ownerType,
    premiumOwnerId: ownerDoc._id,
    premiumOwnerGroupId: '',
  };
  if (ownerType === 'yoresel_etkinlik') {
    out.premiumOwnerGroupId = String(ownerDoc.loginGroupId || '').trim();
  }
  return out;
}

async function hashPremiumPasswordIfProvided(body, existingPassword) {
  const plain = String(body.password || '').trim();
  if (plain) {
    if (plain.length < 6) throw new Error('Premium giriş şifresi en az 6 karakter olmalı');
    return bcrypt.hash(plain, 10);
  }
  return existingPassword || '';
}

module.exports = {
  PREMIUM_OWNER_TYPES,
  ownerMetaFromDoc,
  buildPremiumOwnerConfig,
  premiumOwnerContentQuery,
  premiumOwnerIdsForCreate,
  hashPremiumPasswordIfProvided,
  phoneDigitsOnly,
};
