const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const User = require('./models/User');
const Business = require('./models/Business');
const Admin = require('./models/Admin');
const Reservation = require('./models/Reservation');
const Esnaf = require('./models/Esnaf');
const Kampanya = require('./models/Kampanya');
const Duyuru = require('./models/Duyuru');
const Cekici = require('./models/Cekici');
const Lastikci = require('./models/Lastikci');
const Taksi = require('./models/Taksi');
const IsIlani = require('./models/IsIlani');
const AppSettings = require('./models/AppSettings');
const YoreselEtkinlikIsletme = require('./models/YoreselEtkinlikIsletme');
const YoreselEtkinlikTalep = require('./models/YoreselEtkinlikTalep');
const MemberDiscount = require('./models/MemberDiscount');
const {
  normalizeMemberId,
  isValidMemberIdFormat,
  generateUniqueMemberId,
  ensureUserMemberId,
  formatUserForClient,
} = require('./utils/memberId');
const {
  resolveLocationFieldsFromBody,
  enrichListForMap,
} = require('./utils/mapLocation');
const {
  normalizeDateStr: normalizeReservationDateStr,
  isDateManuallyClosed,
  getReservationSlotsForBusiness,
  isSlotAllowedForBusiness,
  sanitizeClosedDatesList,
  getOpeningHoursForDate,
} = require('./utils/reservationSlots');
const {
  EVENT_TYPES: YORESEL_EVENT_TYPES,
  TIME_SLOTS: YORESEL_TIME_SLOTS,
  SERVICE_KEYS: YORESEL_SERVICE_KEYS,
} = require('./models/YoreselEtkinlikTalep');
const { SERVICE_TAGS: YORESEL_SERVICE_TAGS, TIME_SLOTS: YORESEL_ISLETME_TIME_SLOTS } = require('./models/YoreselEtkinlikIsletme');
const {
  PREMIUM_OWNER_TYPES,
  ownerMetaFromDoc,
  buildPremiumOwnerConfig,
  premiumOwnerContentQuery,
  premiumOwnerIdsForCreate,
  hashPremiumPasswordIfProvided,
} = require('./utils/premiumOwner');
const { openingHoursFromBody, applyOpeningHoursAndMenuToSet } = require('./utils/openingHours');
const { applyMediaFilesToSet, enrichListingMedia, enrichListingMediaList } = require('./utils/listingMedia');
const registerPremiumRoutes = require('./routes/premiumRoutes');

const YORESEL_SERVICE_LABELS = {
  muzisyen: 'Müzisyen',
  asci: 'Aşçı',
  susleme: 'Süsleme / organizasyon',
  zurna: 'Zurna ekibi',
  parkSalon: 'Park / salon',
  mekan: 'Mekan',
  kuafor: 'Kuaför',
  aracKiralama: 'Araç kiralama',
};

const YORESEL_EVENT_LABELS = {
  dugun: 'Düğün',
  nisan: 'Nişan',
  kina: 'Kına',
  sunnet: 'Sünnet',
  bekarliga_veda: 'Bekarlığa veda',
  asker_eglencesi: 'Asker eğlencesi',
  dogum_gunu: 'Doğum günü',
};

const YORESEL_TIME_SLOT_LABELS = {
  gunduz: 'Gündüz (10:00 - 18:00)',
  aksam: 'Akşam (18:00 - 23:59)',
  tam_gun: 'Tam gün (10:00 - 23:59)',
};

function normalizeYoreselTimeSlot(raw) {
  const s = String(raw ?? '').trim();
  if (YORESEL_TIME_SLOTS.includes(s)) return s;
  return 'tam_gun';
}

function yoreselTimeSlotsConflict(a, b) {
  const x = normalizeYoreselTimeSlot(a);
  const y = normalizeYoreselTimeSlot(b);
  if (x === 'tam_gun' || y === 'tam_gun') return true;
  return x === y;
}

function emptyYoreselSlotDay() {
  return {
    gunduz: { pending: 0, approved: 0 },
    aksam: { pending: 0, approved: 0 },
    tam_gun: { pending: 0, approved: 0 },
  };
}

function yoreselOfferedSlotsFromDoc(doc) {
  const arr = Array.isArray(doc?.offeredTimeSlots) ? doc.offeredTimeSlots : [];
  const filtered = arr.filter((t) => YORESEL_ISLETME_TIME_SLOTS.includes(t));
  return filtered.length > 0 ? filtered : [...YORESEL_ISLETME_TIME_SLOTS];
}

function yoreselTimeSlotForService(talep, serviceKey) {
  const raw = talep?.serviceTimeSlots?.[serviceKey];
  if (raw) return normalizeYoreselTimeSlot(raw);
  return normalizeYoreselTimeSlot(talep?.timeSlot);
}

function yoreselSlotsForIsletmeOnTalep(talep, isletmeId) {
  const sid = String(isletmeId);
  const slots = new Set();
  YORESEL_SERVICE_KEYS.forEach((key) => {
    if (!talep?.services?.[key]) return;
    const target = talep?.serviceTargets?.[key];
    if (target != null && String(target) === sid) {
      slots.add(yoreselTimeSlotForService(talep, key));
    }
  });
  if (slots.size === 0 && talep?.targetIsletme != null && String(talep.targetIsletme) === sid) {
    slots.add(normalizeYoreselTimeSlot(talep.timeSlot));
  }
  if (slots.size === 0 && (talep?.allTargetIsletmeler || []).some((x) => String(x) === sid)) {
    slots.add(normalizeYoreselTimeSlot(talep.timeSlot));
  }
  return [...slots];
}

function yoreselServiceSlotLinesForIsletme(talep, isletmeId) {
  const sid = String(isletmeId);
  const lines = [];
  YORESEL_SERVICE_KEYS.forEach((key) => {
    if (!talep?.services?.[key]) return;
    const target = talep?.serviceTargets?.[key];
    if (target == null || String(target) !== sid) return;
    const slot = yoreselTimeSlotForService(talep, key);
    lines.push({
      serviceKey: key,
      label: YORESEL_SERVICE_LABELS[key] || key,
      timeSlot: slot,
      timeSlotLabel: YORESEL_TIME_SLOT_LABELS[slot] || slot,
    });
  });
  return lines;
}

function yoreselEnrichTalepForIsletme(talep, isletmeId) {
  const slotLines = yoreselServiceSlotLinesForIsletme(talep, isletmeId);
  const slots = yoreselSlotsForIsletmeOnTalep(talep, isletmeId);
  const labels = slots.map((s) => YORESEL_TIME_SLOT_LABELS[s] || s);
  return {
    ...talep,
    serviceSlotLines: slotLines,
    effectiveTimeSlots: slots,
    effectiveTimeSlotLabel: labels.length === 1 ? labels[0] : labels.join(' · '),
  };
}

async function yoreselIsletmeSlotConflict(isletmeId, date, timeSlot, excludeTalepId = null) {
  const query = {
    allTargetIsletmeler: new mongoose.Types.ObjectId(isletmeId),
    date,
    status: { $ne: 'cancelled' },
  };
  if (excludeTalepId && mongoose.Types.ObjectId.isValid(String(excludeTalepId))) {
    query._id = { $ne: excludeTalepId };
  }
  const taleps = await YoreselEtkinlikTalep.find(query).lean();
  const slot = normalizeYoreselTimeSlot(timeSlot);
  for (const t of taleps) {
    const eff = yoreselEffectiveStatusForIsletme(t, isletmeId);
    if (!['pending', 'approved'].includes(eff)) continue;
    const existingSlots = yoreselSlotsForIsletmeOnTalep(t, isletmeId);
    for (const existing of existingSlots) {
      if (yoreselTimeSlotsConflict(existing, slot)) {
        return { conflict: true, existingSlot: existing };
      }
    }
  }
  return { conflict: false };
}

function yoreselIsletmeStatusesInitial(allTargetIds, perStatus = 'pending') {
  return (allTargetIds || []).map((id) => ({
    isletme: id,
    status: perStatus,
  }));
}

function yoreselEnsureIsletmeStatuses(talepDoc) {
  const targets = talepDoc.allTargetIsletmeler || [];
  const arr = talepDoc.isletmeStatuses;
  if (!Array.isArray(arr) || arr.length === 0) {
    let legacy = 'pending';
    if (talepDoc.status === 'approved') legacy = 'approved';
    else if (talepDoc.status === 'rejected') legacy = 'rejected';
    talepDoc.isletmeStatuses = targets.map((id) => ({ isletme: id, status: legacy }));
  } else if (targets.length > 0) {
    const missing = targets.filter((id) => !arr.some((e) => String(e.isletme) === String(id)));
    missing.forEach((id) => {
      talepDoc.isletmeStatuses.push({ isletme: id, status: 'pending' });
    });
  }
}

function yoreselEffectiveStatusForIsletme(talepLeanOrDoc, isletmeIdStr) {
  const sid = String(isletmeIdStr);
  if (talepLeanOrDoc.status === 'cancelled') return 'rejected';
  const rows = talepLeanOrDoc.isletmeStatuses;
  if (Array.isArray(rows) && rows.length > 0) {
    const row = rows.find((x) => String(x.isletme) === sid);
    if (row && row.status) return row.status;
  }
  if (talepLeanOrDoc.status === 'approved') return 'approved';
  if (talepLeanOrDoc.status === 'rejected') return 'rejected';
  return 'pending';
}

function yoreselRecomputeAggregateStatusFromIsletmeRows(talepDoc) {
  const arr = talepDoc.isletmeStatuses;
  if (!Array.isArray(arr) || arr.length === 0) return;
  const st = arr.map((x) => String(x.status));
  if (st.every((s) => s === 'approved')) {
    talepDoc.status = 'approved';
  } else if (st.every((s) => s === 'rejected')) {
    talepDoc.status = 'rejected';
  } else {
    talepDoc.status = 'partial';
  }
}

/** Bugünün tarihini YYYY-MM-DD olarak (yerel saat) döndürür. */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Aynı giriş adı / loginGroup ile erişilebilen yöresel işletme id listesi */
async function getYoreselIsletmeIdsForLogin(loginName) {
  const loginKey = String(loginName ?? '').trim();
  if (!loginKey) return [];
  const rx = new RegExp(`^${escapeRegExp(loginKey)}$`, 'i');
  const seed = await YoreselEtkinlikIsletme.findOne({
    active: true,
    $or: [
      { loginName: rx },
      { $and: [{ $or: [{ loginName: '' }, { loginName: { $exists: false } }] }, { name: rx }] },
    ],
  })
    .select('_id loginGroupId')
    .lean();
  if (!seed) return [];
  const gid = seed.loginGroupId != null ? String(seed.loginGroupId).trim() : '';
  if (gid) {
    const rows = await YoreselEtkinlikIsletme.find({ active: true, loginGroupId: gid }).select('_id').lean();
    return rows.map((r) => String(r._id));
  }
  return [String(seed._id)];
}

async function loadYoreselIsletmeIfAllowed(isletmeId, loginName) {
  const ids = await getYoreselIsletmeIdsForLogin(loginName);
  const sid = String(isletmeId || '').trim();
  if (!sid || !ids.includes(sid)) return null;
  return YoreselEtkinlikIsletme.findById(sid).lean();
}

async function yoreselRegisteredDistrict(isletme) {
  const d = String(isletme?.address?.district || '').trim();
  if (d) return d;
  const gid = String(isletme?.loginGroupId || '').trim();
  if (!gid) return '';
  const row = await YoreselEtkinlikIsletme.findOne({ loginGroupId: gid }).select('address.district').lean();
  return String(row?.address?.district || '').trim();
}

function yoreselOwnerLoginName(isletme, loginName) {
  return String(isletme?.loginName || loginName || isletme?.name || '').trim();
}

/** Yöresel işletme duyuruları: mekân değil, giriş grubu / hesap bazlı */
async function yoreselDuyuruFindQuery(isletme, loginName) {
  const clauses = [];
  const gid = String(isletme?.loginGroupId || '').trim();
  const ownerLoginName = yoreselOwnerLoginName(isletme, loginName);

  if (gid) {
    clauses.push({ yoreselLoginGroupId: gid });
  }
  if (ownerLoginName) {
    clauses.push({
      yoreselIsletme: null,
      yoreselLoginGroupId: gid,
      yoreselLoginName: ownerLoginName,
    });
  }

  const legacyIds = await getYoreselIsletmeIdsForLogin(loginName || ownerLoginName);
  const oids = legacyIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (oids.length) {
    clauses.push({ yoreselIsletme: { $in: oids } });
  }

  return clauses.length ? { $or: clauses } : { _id: null };
}

function getTodayLocalStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Cep / iletişim: yalnızca rakamlar */
function phoneDigitsOnly(v) {
  return String(v ?? '').replace(/\D/g, '');
}

/** Admin / güncelleme gövdelerinde phone ve contactPhone alanlarını sadece rakama çevir */
function sanitizePhoneFieldsInBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = { ...body };
  if (Object.prototype.hasOwnProperty.call(out, 'phone')) {
    out.phone = phoneDigitsOnly(out.phone);
  }
  if (Object.prototype.hasOwnProperty.call(out, 'contactPhone')) {
    out.contactPhone = phoneDigitsOnly(out.contactPhone);
  }
  return out;
}

/** Dolu lisans/kampanya bitiş tarihi bugünden önce olamaz (YYYY-MM-DD, yerel bugün ile karşılaştırılır). */
function validateLicenseExpiryNotBeforeToday(licenseExpiry) {
  const s = licenseExpiry != null ? String(licenseExpiry).trim() : '';
  if (!s) return null;
  const part = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    return 'Geçersiz tarih: YYYY-AA-GG formatında girin.';
  }
  const todayStr = getTodayLocalStr();
  if (part < todayStr) {
    return 'Geçersiz tarih: Lisans bitiş süresi bugünün tarihinden önce olamaz.';
  }
  return null;
}

const ADMIN_TYPES_WITH_LICENSE_EXPIRY = [
  'isletme',
  'esnaf',
  'kampanyalar',
  'duyurular',
  'cekici',
  'lastikci',
  'taksi',
  'isilanlari',
  'yoresel_etkinlik',
];

/** Bugünden önce lisans bitiş tarihine sahip kayıtları siler. */
async function deleteExpiredLicenses(Model) {
  const todayStr = getTodayLocalStr();
  const result = await Model.deleteMany({
    licenseExpiry: { $exists: true, $ne: '', $lt: todayStr },
  });
  if (result.deletedCount > 0) {
    console.log(`[cleanup] Lisansı geçmiş ${result.deletedCount} kayıt silindi (${Model.modelName}).`);
  }
  return result.deletedCount;
}

const {
  turkishAddressVariants,
  filterListByAddress,
  mergeAddressStringFilters,
} = require('./utils/addressMatch');

// Connect to database
connectDB();

const PREMIUM_OWNER = buildPremiumOwnerConfig({
  Business,
  Esnaf,
  Cekici,
  Lastikci,
  Taksi,
  YoreselEtkinlikIsletme,
});

async function loadPremiumOwnerForRequest(ownerType, ownerId, loginKey) {
  const cfg = PREMIUM_OWNER[ownerType];
  if (!cfg || !PREMIUM_OWNER_TYPES.includes(ownerType)) return null;
  return cfg.verifyAccess(ownerId, loginKey);
}

function premiumAddressField(bodyVal, nestedVal, fallbackVal, defaultVal = '') {
  const fromBody = bodyVal !== undefined && bodyVal !== null ? String(bodyVal).trim() : '';
  if (fromBody) return fromBody;
  const fromNested = nestedVal !== undefined && nestedVal !== null ? String(nestedVal).trim() : '';
  if (fromNested) return fromNested;
  const fromFallback = fallbackVal !== undefined && fallbackVal !== null ? String(fallbackVal).trim() : '';
  if (fromFallback) return fromFallback;
  return defaultVal;
}

function premiumAddressFromBody(body, fallbackAddress) {
  const fb = fallbackAddress && typeof fallbackAddress === 'object' ? fallbackAddress : {};
  return {
    city: premiumAddressField(body?.addressCity, body?.address?.city, fb.city, 'Muğla'),
    district: premiumAddressField(body?.addressDistrict, body?.address?.district, fb.district, ''),
    neighborhood: premiumAddressField(body?.addressNeighborhood, body?.address?.neighborhood, fb.neighborhood, ''),
  };
}

const PREMIUM_OWNER_MODELS = {
  isletme: Business,
  esnaf: Esnaf,
  cekici: Cekici,
  lastikci: Lastikci,
  taksi: Taksi,
  yoresel_etkinlik: YoreselEtkinlikIsletme,
};

async function enrichPremiumOwnerListItems(items, { kind = 'kampanya' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const idsByType = {};
  items.forEach((item) => {
    const ownerType = String(item.premiumOwnerType || '').trim();
    const ownerId = item.premiumOwnerId;
    if (!ownerType || !ownerId || !PREMIUM_OWNER_MODELS[ownerType]) return;
    if (!idsByType[ownerType]) idsByType[ownerType] = new Set();
    idsByType[ownerType].add(String(ownerId));
  });

  const ownerMap = new Map();
  await Promise.all(
    Object.entries(idsByType).map(async ([ownerType, idSet]) => {
      const Model = PREMIUM_OWNER_MODELS[ownerType];
      const ids = [...idSet].filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (ids.length === 0) return;
      const select =
        ownerType === 'isletme'
          ? 'businessName phone address'
          : ownerType === 'cekici' || ownerType === 'taksi'
            ? 'companyName phone address'
            : ownerType === 'yoresel_etkinlik'
              ? 'loginName name phone address'
              : 'name phone address';
      const docs = await Model.find({ _id: { $in: ids } }).select(select).lean();
      docs.forEach((doc) => {
        const meta = ownerMetaFromDoc(ownerType, doc);
        ownerMap.set(`${ownerType}:${String(doc._id)}`, {
          ownerType,
          displayName: meta.displayName,
          phone: meta.phone,
          address: meta.address || {},
        });
      });
    })
  );

  return items.map((item) => {
    const ownerType = String(item.premiumOwnerType || '').trim();
    const ownerId = item.premiumOwnerId ? String(item.premiumOwnerId) : '';
    const owner = ownerId ? ownerMap.get(`${ownerType}:${ownerId}`) : null;
    const out = { ...item };
    if (!owner) return out;

    out.premiumOwner = owner;
    const addr = item.address && typeof item.address === 'object' ? item.address : {};
    out.address = {
      city: premiumAddressField(addr.city, null, owner.address?.city, 'Muğla'),
      district: premiumAddressField(addr.district, null, owner.address?.district, ''),
      neighborhood: premiumAddressField(addr.neighborhood, null, owner.address?.neighborhood, ''),
    };

    if (kind === 'kampanya') {
      if (!String(out.companyName || '').trim()) out.companyName = owner.displayName;
      if (!String(out.contactPhone || '').trim()) out.contactPhone = owner.phone;
    } else {
      if (!String(out.company || '').trim()) out.company = owner.displayName;
      if (!String(out.contactPhone || '').trim()) out.contactPhone = owner.phone;
    }
    return out;
  });
}

async function listingPremiumCreateFields(body) {
  const premium = body.premium === true;
  let password = '';
  if (premium) {
    password = await hashPremiumPasswordIfProvided(body, '');
    if (!password) {
      throw new Error('Premium için giriş şifresi en az 6 karakter olmalı');
    }
  }
  return { premium, password };
}

async function applyListingPremiumUpdateFields(set, body) {
  if (body.premium !== undefined) set.premium = body.premium === true;
  if (body.premium === true && body.password !== undefined) {
    const pwd = await hashPremiumPasswordIfProvided(body, null);
    if (pwd) set.password = pwd;
    else if (String(body.password || '').trim()) {
      throw new Error('Premium şifresi en az 6 karakter olmalı');
    }
  }
  if (set.password === null || set.password === '') delete set.password;
}

const PORT = process.env.PORT || 3000;
const app = express();

// Uploads: menü PDF
const uploadsDir = path.join(__dirname, 'uploads', 'menus');
const uploadsImagesDir = path.join(__dirname, 'uploads', 'images');
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(uploadsImagesDir)) fs.mkdirSync(uploadsImagesDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'menu.pdf').replace(/[^a-zA-Z0-9.-]/g, '_')),
});
const storageImage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsImagesDir),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'image.jpg').replace(/[^a-zA-Z0-9.-]/g, '_')),
});
const uploadMenuPdf = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('menuPdf');
const uploadImage = multer({ storage: storageImage, limits: { fileSize: 5 * 1024 * 1024 } }).single('image');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

registerPremiumRoutes(app, {
  mongoose,
  bcrypt,
  Kampanya,
  IsIlani,
  validateLicenseExpiryNotBeforeToday,
  PREMIUM_OWNER,
  loadPremiumOwnerForRequest,
  ownerMetaFromDoc,
  premiumOwnerContentQuery,
  premiumOwnerIdsForCreate,
  premiumAddressFromBody,
  PREMIUM_OWNER_TYPES,
  phoneDigitsOnly,
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Mobile App Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      data: '/api/data',
    },
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/data', (req, res) => {
  res.json({
    message: 'Data from backend',
    data: {
      items: [
        { id: 1, name: 'Item 1', description: 'First item' },
        { id: 2, name: 'Item 2', description: 'Second item' },
        { id: 3, name: 'Item 3', description: 'Third item' },
      ],
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/data', (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  res.json({
    message: 'Data created successfully',
    data: {
      id: Date.now(),
      name,
      description: description || '',
      createdAt: new Date().toISOString(),
    },
  });
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available. Please start MongoDB.',
      });
    }

    const {
      username,
      password,
      name,
      surname,
      phone,
      dateOfBirth,
      specialDay,
      address,
    } = req.body;

    // Validation
    const required = [
      username, password, name, surname, phone, dateOfBirth, specialDay,
      address?.city, address?.district, address?.neighborhood,
    ];
    if (required.some((v) => !v || (typeof v === 'string' && !v.trim()))) {
      return res.status(400).json({
        error: 'Tüm alanlar zorunludur',
        message: 'All fields are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Şifre en az 6 karakter olmalıdır',
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({
      username: username.trim().toLowerCase(),
    });
    if (existingUser) {
      return res.status(400).json({
        error: 'Bu kullanıcı adı zaten kullanılıyor',
        message: 'Username already exists',
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const memberId = await generateUniqueMemberId();

    // Create new user
    const user = new User({
      memberId,
      username: username.trim().toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      surname: surname.trim(),
      phone: phoneDigitsOnly(phone),
      dateOfBirth: dateOfBirth.trim(),
      specialDay: specialDay.trim(),
      address: {
        city: address.city.trim(),
        district: address.district.trim(),
        neighborhood: address.neighborhood.trim(),
      },
    });

    await user.save();

    res.status(201).json({
      message: 'Kayıt başarılı',
      success: true,
      user: formatUserForClient(user),
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle MongoDB-specific errors
    if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError') {
      return res.status(503).json({
        error: 'Veritabanı hatası',
        message: 'Database error. Please check MongoDB connection.',
      });
    }

    res.status(500).json({
      error: 'Kayıt sırasında bir hata oluştu',
      message: error.message,
    });
  }
});

// Menü PDF yükleme
app.post('/api/upload-menu-pdf', (req, res) => {
  uploadMenuPdf(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'PDF yüklenemedi', message: err.message });
    if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
    res.json({ url: '/uploads/menus/' + req.file.filename });
  });
});

app.post('/api/upload/image', (req, res) => {
  uploadImage(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Fotoğraf yüklenemedi', message: err.message });
    if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
    res.json({ url: '/uploads/images/' + req.file.filename });
  });
});

// Uygulama ayarları (ana sayfa fotoğrafı vb.)
app.get('/api/app-settings', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const doc = await AppSettings.findOne().lean();
    res.json({ homeImageUrl: (doc && doc.homeImageUrl) ? doc.homeImageUrl : '' });
  } catch (e) {
    console.error('App settings get error:', e);
    res.status(500).json({ error: 'Ayarlar alınamadı', homeImageUrl: '' });
  }
});

async function updateAppSettingsHandler(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const homeImageUrl = (req.body.homeImageUrl != null ? String(req.body.homeImageUrl) : '').trim();
    const doc = await AppSettings.findOneAndUpdate(
      {},
      { $set: { homeImageUrl } },
      { new: true, upsert: true }
    ).lean();
    res.json({ homeImageUrl: doc.homeImageUrl || '' });
  } catch (e) {
    console.error('App settings update error:', e);
    res.status(500).json({ error: 'Ayarlar güncellenemedi', message: e.message });
  }
}
app.patch('/api/app-settings', updateAppSettingsHandler);
app.put('/api/app-settings', updateAppSettingsHandler);

// İşletme kayıt endpoint
app.post('/api/register-business', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available. Please start MongoDB.',
      });
    }

    const {
      businessName,
      password,
      phone,
      activityField,
      googleLocation,
      openingHours,
      address,
      menuPdfUrl,
      googleReviewLink,
      website,
      instagram,
      hasChargingStation,
      hasFreeParking,
      hasFreeValet,
      hasPaidParking,
      hasPaidValet,
      licenseExpiry,
      limanCikisSaati,
      limanGelisSaati,
    } = req.body;

    const required = [
      businessName, password, activityField,
      address?.city, address?.district, address?.neighborhood,
    ];
    if (required.some((v) => !v || (typeof v === 'string' && !v.trim()))) {
      return res.status(400).json({
        error: 'İşletme adı, şifre, faaliyet alanı ve adres (il, ilçe, mahalle) zorunludur',
        message: 'All required fields must be filled',
      });
    }

    const validActivity = ['restorant', 'cafe_bar', 'tekne_turu', 'plaj_beach'];
    if (!validActivity.includes(activityField)) {
      return res.status(400).json({
        error: 'Geçersiz faaliyet alanı',
        message: 'Invalid activity field',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Şifre en az 6 karakter olmalıdır',
        message: 'Password must be at least 6 characters',
      });
    }

    const existing = await Business.findOne({
      businessName: { $regex: new RegExp(`^${businessName.trim()}$`, 'i') },
    });
    if (existing) {
      return res.status(400).json({
        error: 'Bu işletme adı zaten kayıtlı',
        message: 'Business name already registered',
      });
    }

    const licTrim = (licenseExpiry != null ? String(licenseExpiry) : '').trim();
    if (licTrim) {
      const licErr = validateLicenseExpiryNotBeforeToday(licTrim);
      if (licErr) {
        return res.status(400).json({ error: licErr, message: licErr });
      }
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const addressNorm = {
      city: address.city.trim(),
      district: address.district.trim(),
      neighborhood: address.neighborhood.trim(),
    };
    const loc = await resolveLocationFieldsFromBody(
      { googleLocation: (googleLocation || '').trim() },
      addressNorm
    );

    const business = new Business({
      businessName: businessName.trim(),
      password: hashedPassword,
      phone: phoneDigitsOnly(phone),
      activityField: activityField.trim(),
      googleLocation: loc.googleLocation,
      latitude: loc.latitude,
      longitude: loc.longitude,
      mapLocationSource: loc.mapLocationSource,
      openingHours: {
        weekdays: {
          open: (openingHours?.weekdays?.open || 'Kapalı').trim(),
          close: (openingHours?.weekdays?.close || '').trim(),
        },
        weekend: {
          open: (openingHours?.weekend?.open || 'Kapalı').trim(),
          close: (openingHours?.weekend?.close || '').trim(),
        },
      },
      address: {
        city: address.city.trim(),
        district: address.district.trim(),
        neighborhood: address.neighborhood.trim(),
      },
      menuPdfUrl: (menuPdfUrl || '').trim(),
      googleReviewLink: (googleReviewLink || '').trim(),
      website: (website || '').trim(),
      instagram: (instagram || '').trim(),
      hasChargingStation: !!hasChargingStation,
      hasFreeParking: !!hasFreeParking,
      hasFreeValet: !!hasFreeValet,
      hasPaidParking: !!hasPaidParking,
      hasPaidValet: !!hasPaidValet,
      licenseExpiry: (licenseExpiry != null ? String(licenseExpiry) : '').trim(),
      approved: false,
      limanCikisSaati: (limanCikisSaati != null ? String(limanCikisSaati) : '').trim(),
      limanGelisSaati: (limanGelisSaati != null ? String(limanGelisSaati) : '').trim(),
    });

    await business.save();

    res.status(201).json({
      message: 'Kaydınız alındı. Admin onayından sonra işletme girişi yapabilirsiniz.',
      success: true,
      business: {
        id: business._id,
        businessName: business.businessName,
        activityField: business.activityField,
      },
    });
  } catch (error) {
    console.error('Business registration error:', error);
    if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError') {
      return res.status(503).json({
        error: 'Veritabanı hatası',
        message: 'Database error. Please check MongoDB connection.',
      });
    }
    res.status(500).json({
      error: 'İşletme kaydı sırasında bir hata oluştu',
      message: error.message,
    });
  }
});

// Admin kayıt (veritabanına saklanır)
app.post('/api/register-admin', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available.',
      });
    }
    const { username, password, name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
    }
    const existing = await Admin.findOne({ username: username.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kayıtlı' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({
      username: username.trim().toLowerCase(),
      password: hashedPassword,
      name: (name || '').trim(),
    });
    await admin.save();
    res.status(201).json({
      message: 'Admin kaydı başarılı',
      success: true,
      admin: { id: admin._id, username: admin.username },
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Admin kaydı sırasında bir hata oluştu', message: error.message });
  }
});

// Admin giriş (veritabanından doğrulanır)
app.post('/api/login-admin', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available.',
      });
    }
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre girin' });
    }
    const admin = await Admin.findOne({ username: username.trim().toLowerCase() });
    if (!admin) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }
    res.json({
      message: 'Giriş başarılı',
      success: true,
      admin: { id: admin._id, username: admin.username },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Giriş sırasında hata', message: error.message });
  }
});

// İşletme giriş
app.post('/api/login-business', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available.',
      });
    }
    const { businessName, password } = req.body;
    if (!businessName || !password) {
      return res.status(400).json({ error: 'İşletme adı ve şifre girin' });
    }
    const business = await Business.findOne({
      businessName: { $regex: new RegExp(`^${businessName.trim()}$`, 'i') },
    });
    if (!business) {
      return res.status(401).json({ error: 'Geçersiz işletme adı veya şifre' });
    }
    // admin onayı olmadan işletme girişine izin verme.
    // DB'de yanlışlıkla string/undefined değer oluşsa bile bloklamak için strict kontrol kullanıyoruz.
    if (business.approved !== true) {
      return res.status(403).json({ error: 'Hesabınız henüz onaylanmadı. Lütfen admin onayı bekleyin.' });
    }
    const match = await bcrypt.compare(password, business.password);
    if (!match) {
      return res.status(401).json({ error: 'Geçersiz işletme adı veya şifre' });
    }
    res.json({
      message: 'Giriş başarılı',
      success: true,
      business: {
        id: business._id,
        businessName: business.businessName,
        activityField: business.activityField,
        premium: business.premium === true,
      },
    });
  } catch (error) {
    console.error('Business login error:', error);
    res.status(500).json({ error: 'Giriş sırasında hata', message: error.message });
  }
});

// Yöresel etkinlik işletmesi giriş (aynı loginName veya tek mekanda name ile; çoklu mekanda tüm şube listesi döner)
app.post('/api/login-yoresel-isletme', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available.',
      });
    }
    const { name, password } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre girin' });
    }
    const loginKey = String(name).trim();
    const rx = new RegExp(`^${escapeRegExp(loginKey)}$`, 'i');
    const candidates = await YoreselEtkinlikIsletme.find({
      active: true,
      $or: [
        { loginName: rx },
        { $and: [{ $or: [{ loginName: '' }, { loginName: { $exists: false } }] }, { name: rx }] },
      ],
    })
      .limit(80)
      .lean();
    let matched = null;
    for (const c of candidates) {
      if (c.password && (await bcrypt.compare(password, c.password))) {
        matched = c;
        break;
      }
    }
    if (!matched) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }
    const gid = matched.loginGroupId != null ? String(matched.loginGroupId).trim() : '';
    let siblings;
    if (gid) {
      siblings = await YoreselEtkinlikIsletme.find({ active: true, loginGroupId: gid })
        .select('name serviceTags address')
        .sort({ name: 1 })
        .lean();
    } else {
      siblings = [matched];
    }
    const isletmeler = siblings.map((s) => ({
      id: String(s._id),
      name: s.name,
      serviceTags: Array.isArray(s.serviceTags) ? s.serviceTags : [],
      offeredTimeSlots: yoreselOfferedSlotsFromDoc(s),
      neighborhood: s.address && s.address.neighborhood != null ? String(s.address.neighborhood).trim() : '',
      district: s.address && s.address.district != null ? String(s.address.district).trim() : '',
    }));
    const multiVenueLogin = Boolean(gid && isletmeler.length > 1);
    res.json({
      success: true,
      isletmeler,
      isletme: isletmeler[0],
      multiVenueLogin,
      premium: matched.premium === true,
      loginName: matched.loginName || '',
    });
  } catch (error) {
    console.error('Yoresel isletme login error:', error);
    res.status(500).json({ error: 'Giriş sırasında hata', message: error.message });
  }
});

// Kullanıcı girişi (kayıtlı kullanıcı adı + şifre ile doğrulama)
app.post('/api/login-user', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Veritabanı bağlantısı yok',
        message: 'Database connection not available.',
      });
    }
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre girin' });
    }
    const user = await User.findOne({
      username: username.trim().toLowerCase(),
    });
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }
    await ensureUserMemberId(user);
    res.json({
      message: 'Giriş başarılı',
      success: true,
      user: formatUserForClient(user),
    });
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ error: 'Giriş sırasında hata', message: error.message });
  }
});

app.get('/api/user/profile', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const userId = req.query.userId != null ? String(req.query.userId).trim() : '';
    if (!userId) {
      return res.status(400).json({ error: 'userId gerekli' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    await ensureUserMemberId(user);
    res.json({ user: formatUserForClient(user) });
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ error: 'Profil alınamadı', message: error.message });
  }
});

app.get('/api/user/member-discounts', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok', discounts: [] });
    }
    const userId = req.query.userId != null ? String(req.query.userId).trim() : '';
    if (!userId) {
      return res.status(400).json({ error: 'userId gerekli', discounts: [] });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı', discounts: [] });
    }
    await ensureUserMemberId(user);
    const memberId = normalizeMemberId(user.memberId);
    if (!memberId) {
      return res.json({ discounts: [] });
    }
    const raw = await MemberDiscount.find({ memberId, active: true })
      .populate('business', 'businessName')
      .sort({ createdAt: -1 })
      .lean();
    const discounts = raw
      .filter((d) => !isMemberDiscountExpired(d.validUntil))
      .map((d) => ({
        _id: d._id,
        businessName: d.business?.businessName || '',
        title: d.title || '',
        description: d.description || '',
        discountPercent: d.discountPercent,
        validUntil: d.validUntil || '',
        note: d.note || '',
      }));
    res.json({ discounts });
  } catch (error) {
    console.error('User member discounts error:', error);
    res.status(500).json({ error: 'İndirimler alınamadı', discounts: [], message: error.message });
  }
});

function isMemberDiscountExpired(validUntil) {
  const s = String(validUntil ?? '').trim();
  if (!s) return false;
  const part = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return false;
  return part < getTodayLocalStr();
}

app.post('/api/business/:businessId/member-discount/check', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const businessId = String(req.params.businessId || '').trim();
    if (!businessId) {
      return res.status(400).json({ valid: false, error: 'İşletme kimliği gerekli' });
    }
    const business = await Business.findById(businessId).select('businessName approved').lean();
    if (!business || business.approved === false) {
      return res.status(404).json({ valid: false, error: 'İşletme bulunamadı' });
    }
    const memberId = normalizeMemberId(req.body?.memberId);
    if (!memberId) {
      return res.status(400).json({ valid: false, error: 'Üye numarası girin' });
    }
    if (!isValidMemberIdFormat(memberId)) {
      return res.status(400).json({ valid: false, error: 'Geçersiz üye numarası formatı (ör. 48X7K9M2)' });
    }
    const user = await User.findOne({ memberId }).select('name surname memberId').lean();
    if (!user) {
      return res.status(404).json({ valid: false, error: 'Bu üye numarasına kayıtlı kullanıcı bulunamadı' });
    }
    const member = {
      memberId: user.memberId,
      name: user.name || '',
      surname: user.surname || '',
      displayName: [user.name, user.surname].filter(Boolean).join(' ') || 'Üye',
    };
    const discount = await MemberDiscount.findOne({
      business: businessId,
      memberId,
      active: true,
    }).lean();
    if (!discount) {
      return res.json({
        valid: false,
        error: 'Bu işletme için bu üyeye tanımlı aktif indirim yok',
        member,
      });
    }
    if (isMemberDiscountExpired(discount.validUntil)) {
      return res.json({
        valid: false,
        error: 'İndirim süresi dolmuş',
        expired: true,
        member,
        discount: {
          title: discount.title || '',
          description: discount.description || '',
          discountPercent: discount.discountPercent,
          validUntil: discount.validUntil || '',
        },
      });
    }
    res.json({
      valid: true,
      member,
      discount: {
        title: discount.title || '',
        description: discount.description || '',
        discountPercent: discount.discountPercent,
        validUntil: discount.validUntil || '',
      },
    });
  } catch (error) {
    console.error('Member discount check error:', error);
    res.status(500).json({ valid: false, error: 'Kontrol yapılamadı', message: error.message });
  }
});

// Nöbetçi eczane proxy (EczaneAPI). .env'de ECZANE_API_KEY tanımlı olmalı)
app.get('/api/pharmacies/on-duty', async (req, res) => {
  try {
    const { city, district } = req.query;
    const apiKey = process.env.ECZANE_API_KEY?.trim();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Nöbetçi eczane servisi yapılandırılmamış',
        hint: "backend/.env dosyasına ECZANE_API_KEY ekleyin (eczaneapi.com'dan ücretsiz alın)",
        pharmacies: [],
      });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'city (il) parametresi gerekli', pharmacies: [] });
    }
    const params = new URLSearchParams({ city: String(city).trim() });
    if (district && String(district).trim()) params.set('district', String(district).trim());
    const url = `https://eczaneapi.com/api/v1/pharmacies/on-duty?${params.toString()}`;
    const apiRes = await fetch(url, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    });
    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      return res.status(apiRes.status === 429 ? 429 : 502).json({
        error: data.error || 'Eczane listesi alınamadı',
        pharmacies: [],
      });
    }
    const list = (data.data && data.data.pharmacies) ? data.data.pharmacies : [];
    res.json({
      city: data.data?.city?.name || city,
      district: data.data?.district?.name || district || null,
      date: data.data?.date || null,
      pharmacies: list.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        phone: p.phone,
        phone2: p.phone2,
        location: p.location,
      })),
    });
  } catch (e) {
    console.error('Pharmacies on-duty error:', e);
    res.status(500).json({ error: 'Nöbetçi eczane listesi alınamadı', pharmacies: [] });
  }
});

// Tüm işletmeler (işletme sayfasında listelenir, şifre dönmez)
app.get('/api/businesses', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Business);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const activityField = req.query.activityField != null ? String(req.query.activityField).trim() : '';
    const hasChargingStation = req.query.hasChargingStation === 'true' || req.query.hasChargingStation === '1';

    const query = {};
    mergeAddressStringFilters(query, city, district, neighborhood);
    if (activityField && ['restorant', 'cafe_bar', 'tekne_turu', 'plaj_beach'].includes(activityField)) {
      query.activityField = activityField;
    }
    if (hasChargingStation) {
      query.hasChargingStation = true;
    }
    query.approved = true;
    let list = await Business.find(query).select('-password').sort({ businessName: 1 }).lean();
    if (req.query.forMap === '1' || req.query.forMap === 'true') {
      list = await enrichListForMap(list, { forMap: true, Model: Business });
    }
    list = enrichListingMediaList(list);
    res.json({ businesses: list });
  } catch (error) {
    console.error('Businesses list error:', error);
    res.status(500).json({ error: 'İşletmeler alınamadı', message: error.message });
  }
});

// Kullanıcı arayüzü: Admin'den eklenen esnaflar, kategori ve ilçeye göre filtrelenebilir
app.get('/api/esnaf', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const category = req.query.category != null ? String(req.query.category).trim() : '';

    const query = {};
    mergeAddressStringFilters(query, city, district, neighborhood);
    if (category) {
      const catVar = turkishAddressVariants(category);
      if (catVar) query.category = { $in: catVar };
    }
    let list = await Esnaf.find(query).select('-password').sort({ name: 1 }).lean();
    if (req.query.forMap === '1' || req.query.forMap === 'true') {
      list = await enrichListForMap(list, { forMap: true, Model: Esnaf });
    }
    list = enrichListingMediaList(list);
    res.json({ esnaflar: list });
  } catch (error) {
    console.error('Esnaf list error:', error);
    res.status(500).json({ error: 'Esnaflar alınamadı', message: error.message });
  }
});

// Esnaf filtre seçenekleri (kategori ve ilçe listesi)
app.get('/api/esnaf/filters', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const [districts, categories] = await Promise.all([
      Esnaf.distinct('address.district').then((arr) => arr.filter(Boolean).sort()),
      Esnaf.distinct('category').then((arr) => arr.filter(Boolean).sort()),
    ]);
    res.json({ districts, categories });
  } catch (error) {
    console.error('Esnaf filters error:', error);
    res.status(500).json({ districts: [], categories: [] });
  }
});

// Yöresel etkinlik: kayıtlı işletmeler (hizmet alanına göre)
app.get('/api/yoresel-etkinlik/isletmeler', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(YoreselEtkinlikIsletme);
    const serviceTag = req.query.serviceTag != null ? String(req.query.serviceTag).trim() : '';
    const query = { active: true };
    if (serviceTag && YORESEL_SERVICE_TAGS.includes(serviceTag)) {
      query.serviceTags = serviceTag;
    }
    const list = await YoreselEtkinlikIsletme.find(query).select('-password').sort({ name: 1 }).lean();
    const isletmeler = enrichListingMediaList(
      list.map((s) => ({
        ...s,
        offeredTimeSlots: yoreselOfferedSlotsFromDoc(s),
      }))
    );
    res.json({ isletmeler, serviceTags: YORESEL_SERVICE_TAGS, timeSlotOptions: YORESEL_TIME_SLOT_LABELS });
  } catch (e) {
    console.error('Yoresel etkinlik isletmeler error:', e);
    res.status(500).json({ error: 'Liste alınamadı', isletmeler: [] });
  }
});

// Yöresel etkinlik: seçilen işletme için yıllık doluluk (onaylı / bekleyen talepler)
app.get('/api/yoresel-etkinlik/isletmeler/:id/takvim', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { id } = req.params;
    const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'Geçersiz year' });
    }
    const isletme = await YoreselEtkinlikIsletme.findOne({ _id: id, active: true }).lean();
    if (!isletme) return res.status(404).json({ error: 'İşletme bulunamadı' });
    const oid = new mongoose.Types.ObjectId(id);
    const taleps = await YoreselEtkinlikTalep.find({
      allTargetIsletmeler: oid,
      date: { $regex: new RegExp(`^${year}-`) },
      status: { $ne: 'cancelled' },
    }).lean();
    const offeredTimeSlots = yoreselOfferedSlotsFromDoc(isletme);
    const byDate = {};
    taleps.forEach((t) => {
      const eff = yoreselEffectiveStatusForIsletme(t, id);
      if (!['pending', 'approved'].includes(eff)) return;
      const d = t.date;
      if (!byDate[d]) byDate[d] = emptyYoreselSlotDay();
      const slotsOnDay = yoreselSlotsForIsletmeOnTalep(t, id);
      slotsOnDay.forEach((slot) => {
        if (!byDate[d][slot]) byDate[d][slot] = { pending: 0, approved: 0 };
        if (eff === 'pending') byDate[d][slot].pending += 1;
        else byDate[d][slot].approved += 1;
      });
    });
    res.json({
      year,
      isletmeId: id,
      offeredTimeSlots,
      timeSlotLabels: YORESEL_TIME_SLOT_LABELS,
      byDate,
    });
  } catch (e) {
    console.error('Yoresel etkinlik takvim error:', e);
    res.status(500).json({ error: 'Takvim alınamadı', message: e.message });
  }
});

// Yöresel etkinlik: kullanıcı rezervasyon talebi
app.post('/api/yoresel-etkinlik/talep', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const body = req.body || {};
    const date = String(body.date || '').trim();
    const eventType = String(body.eventType || '').trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Geçersiz tarih (YYYY-MM-DD)' });
    }
    if (!YORESEL_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ error: 'Geçersiz etkinlik türü' });
    }
    const services = {
      muzisyen: !!body.services?.muzisyen,
      asci: !!body.services?.asci,
      susleme: !!body.services?.susleme,
      zurna: !!body.services?.zurna,
      parkSalon: !!body.services?.parkSalon,
      mekan: !!body.services?.mekan,
      kuafor: !!body.services?.kuafor,
      aracKiralama: !!body.services?.aracKiralama,
    };
    const anyService = Object.values(services).some(Boolean);
    if (!anyService) {
      return res.status(400).json({ error: 'En az bir hizmet alanı seçin' });
    }
    const userId = body.userId != null ? String(body.userId).trim() : '';
    const guestName = String(body.guestName || '').trim();
    const guestPhone = phoneDigitsOnly(body.guestPhone);
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı' });
    }
    if (!userId) {
      if (!guestName) return res.status(400).json({ error: 'İsim soyisim gerekli' });
      if (!guestPhone) return res.status(400).json({ error: 'Cep telefonu gerekli' });
    }
    let targetIsletme = null;
    const serviceTargets = {};
    const serviceTimeSlots = {};
    const SERVICE_KEY_TO_TAG = {
      muzisyen: 'muzisyen',
      asci: 'asci',
      susleme: 'susleme',
      zurna: 'zurna',
      parkSalon: 'park_salon',
      mekan: 'mekan',
      kuafor: 'kuafor',
      aracKiralama: 'arac_kiralama',
    };
    const selectedTargetIds = [];
    const slotChecks = [];
    for (const [serviceKey, tag] of Object.entries(SERVICE_KEY_TO_TAG)) {
      if (!services[serviceKey]) {
        serviceTargets[serviceKey] = null;
        serviceTimeSlots[serviceKey] = null;
        continue;
      }
      const slot = normalizeYoreselTimeSlot(
        body.serviceTimeSlots?.[serviceKey] != null ? body.serviceTimeSlots[serviceKey] : body.timeSlot
      );
      serviceTimeSlots[serviceKey] = slot;
      const raw = body.serviceTargets?.[serviceKey] != null ? String(body.serviceTargets[serviceKey]).trim() : '';
      if (!raw) {
        serviceTargets[serviceKey] = null;
        continue;
      }
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ error: `${serviceKey} için seçilen işletme geçersiz` });
      }
      const venForService = await YoreselEtkinlikIsletme.findOne({ _id: raw, active: true }).lean();
      if (!venForService) {
        return res.status(400).json({ error: `${serviceKey} için seçilen işletme bulunamadı` });
      }
      if (!Array.isArray(venForService.serviceTags) || !venForService.serviceTags.includes(tag)) {
        return res.status(400).json({ error: `${serviceKey} için seçilen işletme bu hizmeti vermiyor` });
      }
      serviceTargets[serviceKey] = raw;
      if (!selectedTargetIds.includes(raw)) selectedTargetIds.push(raw);
      slotChecks.push({ venId: raw, slot, serviceKey, label: YORESEL_SERVICE_LABELS[serviceKey] || serviceKey });
    }
    if (body.targetIsletmeId != null && String(body.targetIsletmeId).trim()) {
      const tid = String(body.targetIsletmeId).trim();
      const ven = await YoreselEtkinlikIsletme.findOne({ _id: tid, active: true }).lean();
      if (!ven) return res.status(400).json({ error: 'Seçilen işletme bulunamadı' });
      targetIsletme = tid;
      if (!selectedTargetIds.includes(tid)) selectedTargetIds.push(tid);
    }
    const venCache = {};
    for (const check of slotChecks) {
      let ven = venCache[check.venId];
      if (!ven) {
        ven = await YoreselEtkinlikIsletme.findOne({ _id: check.venId, active: true }).lean();
        if (!ven) continue;
        venCache[check.venId] = ven;
      }
      const offered = yoreselOfferedSlotsFromDoc(ven);
      if (!offered.includes(check.slot)) {
        return res.status(400).json({
          error: `${check.label} — ${ven.name || 'İşletme'} bu dilimde rezervasyon kabul etmiyor (${YORESEL_TIME_SLOT_LABELS[check.slot] || check.slot})`,
        });
      }
      const { conflict, existingSlot } = await yoreselIsletmeSlotConflict(check.venId, date, check.slot);
      if (conflict) {
        return res.status(409).json({
          error: `${check.label} — ${ven.name || 'İşletme'} için ${date} tarihinde ${YORESEL_TIME_SLOT_LABELS[existingSlot] || existingSlot} dolu veya çakışıyor`,
        });
      }
    }
    const firstEnabledSlot = YORESEL_SERVICE_KEYS.find((k) => services[k]);
    const legacyTimeSlot = firstEnabledSlot
      ? serviceTimeSlots[firstEnabledSlot]
      : normalizeYoreselTimeSlot(body.timeSlot);
    const talep = await YoreselEtkinlikTalep.create({
      user: userId || null,
      guestName: userId ? '' : guestName,
      guestPhone: userId ? '' : guestPhone,
      date,
      timeSlot: legacyTimeSlot,
      serviceTimeSlots,
      eventType,
      services,
      targetIsletme,
      serviceTargets,
      allTargetIsletmeler: selectedTargetIds,
      isletmeStatuses: yoreselIsletmeStatusesInitial(selectedTargetIds, 'pending'),
      note: String(body.note || '').trim(),
      status: 'pending',
    });
    await talep.populate('user', 'name surname');
    res.status(201).json({ message: 'Talebiniz iletildi', talep: talep.toObject() });
  } catch (e) {
    console.error('Yoresel etkinlik talep error:', e);
    res.status(500).json({ error: 'Talep oluşturulamadı', message: e.message });
  }
});

// Yöresel işletme paneli: tarihe göre talepler
app.get('/api/yoresel-isletme/:isletmeId/talepler', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId } = req.params;
    const date = String(req.query.date || '').trim();
    if (!mongoose.Types.ObjectId.isValid(isletmeId)) return res.status(400).json({ error: 'Geçersiz işletme' });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Geçersiz tarih' });
    const list = await YoreselEtkinlikTalep.find({
      allTargetIsletmeler: new mongoose.Types.ObjectId(isletmeId),
      date,
    })
      .populate('user', 'name surname phone')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ talepler: list.map((t) => yoreselEnrichTalepForIsletme(t, isletmeId)) });
  } catch (e) {
    console.error('Yoresel isletme date list error:', e);
    res.status(500).json({ error: 'Liste alınamadı', talepler: [] });
  }
});

// Yöresel işletme paneli: bekleyen talepler
app.get('/api/yoresel-isletme/:isletmeId/talepler/pending', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(isletmeId)) return res.status(400).json({ error: 'Geçersiz işletme' });
    const oid = new mongoose.Types.ObjectId(isletmeId);
    const list = await YoreselEtkinlikTalep.find({
      allTargetIsletmeler: oid,
      status: { $ne: 'cancelled' },
    })
      .populate('user', 'name surname phone')
      .sort({ date: 1, createdAt: -1 })
      .lean();
    const filtered = list.filter((t) => yoreselEffectiveStatusForIsletme(t, isletmeId) === 'pending');
    res.json({ talepler: filtered.map((t) => yoreselEnrichTalepForIsletme(t, isletmeId)) });
  } catch (e) {
    console.error('Yoresel isletme pending list error:', e);
    res.status(500).json({ error: 'Liste alınamadı', talepler: [] });
  }
});

// Yöresel işletme paneli: talep onay / red
app.patch('/api/yoresel-isletme/:isletmeId/talepler/:talepId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId, talepId } = req.params;
    const status = String(req.body?.status || '').trim();
    if (!mongoose.Types.ObjectId.isValid(isletmeId) || !mongoose.Types.ObjectId.isValid(talepId)) {
      return res.status(400).json({ error: 'Geçersiz id' });
    }
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum' });
    }
    const talep = await YoreselEtkinlikTalep.findOne({
      _id: talepId,
      allTargetIsletmeler: new mongoose.Types.ObjectId(isletmeId),
    });
    if (!talep) return res.status(404).json({ error: 'Talep bulunamadı' });
    if (talep.status === 'cancelled') return res.status(409).json({ error: 'İptal edilmiş talep güncellenemez' });
    yoreselEnsureIsletmeStatuses(talep);
    const entry = talep.isletmeStatuses.find((e) => String(e.isletme) === String(isletmeId));
    if (!entry) return res.status(404).json({ error: 'Bu talepte işletme kaydı bulunamadı' });
    entry.status = status;
    yoreselRecomputeAggregateStatusFromIsletmeRows(talep);
    talep.markModified('isletmeStatuses');
    await talep.save();
    await talep.populate('user', 'name surname phone');
    res.json({ message: 'Talep güncellendi', talep: talep.toObject() });
  } catch (e) {
    console.error('Yoresel isletme talep status error:', e);
    res.status(500).json({ error: 'Talep güncellenemedi', message: e.message });
  }
});

// Yöresel işletme paneli: manuel rezervasyon (talep) ekleme
app.post('/api/yoresel-isletme/:isletmeId/talepler/manual', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(isletmeId)) return res.status(400).json({ error: 'Geçersiz işletme' });
    const isletme = await YoreselEtkinlikIsletme.findOne({ _id: isletmeId, active: true }).lean();
    if (!isletme) return res.status(404).json({ error: 'İşletme bulunamadı' });
    const date = String(req.body?.date || '').trim();
    const eventType = String(req.body?.eventType || '').trim();
    const guestName = String(req.body?.guestName || '').trim();
    const guestPhone = phoneDigitsOnly(req.body?.guestPhone);
    const note = String(req.body?.note || '').trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Geçersiz tarih' });
    if (!YORESEL_EVENT_TYPES.includes(eventType)) return res.status(400).json({ error: 'Geçersiz etkinlik türü' });
    if (!guestName) return res.status(400).json({ error: 'İsim soyisim gerekli' });
    if (!guestPhone) return res.status(400).json({ error: 'Cep telefonu gerekli' });
    const timeSlot = normalizeYoreselTimeSlot(req.body?.timeSlot);
    const offered = yoreselOfferedSlotsFromDoc(isletme);
    if (!offered.includes(timeSlot)) {
      return res.status(400).json({
        error: `Bu işletme ${YORESEL_TIME_SLOT_LABELS[timeSlot] || timeSlot} diliminde rezervasyon kabul etmiyor`,
      });
    }
    const { conflict, existingSlot } = await yoreselIsletmeSlotConflict(isletmeId, date, timeSlot);
    if (conflict) {
      return res.status(409).json({
        error: `${date} tarihinde ${YORESEL_TIME_SLOT_LABELS[existingSlot] || existingSlot} dolu veya çakışıyor`,
      });
    }

    const services = { muzisyen: false, asci: false, susleme: false, zurna: false, parkSalon: false, mekan: false, kuafor: false, aracKiralama: false };
    const serviceTargets = { muzisyen: null, asci: null, susleme: null, zurna: null, parkSalon: null, mekan: null, kuafor: null, aracKiralama: null };
    const serviceTimeSlots = {
      muzisyen: null,
      asci: null,
      susleme: null,
      zurna: null,
      parkSalon: null,
      mekan: null,
      kuafor: null,
      aracKiralama: null,
    };
    const tagToServiceKey = {
      muzisyen: 'muzisyen',
      asci: 'asci',
      susleme: 'susleme',
      zurna: 'zurna',
      park_salon: 'parkSalon',
      mekan: 'mekan',
      kuafor: 'kuafor',
      arac_kiralama: 'aracKiralama',
    };
    (Array.isArray(isletme.serviceTags) ? isletme.serviceTags : []).forEach((tag) => {
      const key = tagToServiceKey[tag];
      if (!key) return;
      services[key] = true;
      serviceTargets[key] = isletme._id;
      serviceTimeSlots[key] = timeSlot;
    });
    if (!Object.values(services).some(Boolean)) {
      services.mekan = true;
      serviceTargets.mekan = isletme._id;
      serviceTimeSlots.mekan = timeSlot;
    }

    const talep = await YoreselEtkinlikTalep.create({
      user: null,
      guestName,
      guestPhone,
      date,
      timeSlot,
      serviceTimeSlots,
      eventType,
      services,
      targetIsletme: isletme._id,
      serviceTargets,
      allTargetIsletmeler: [isletme._id],
      isletmeStatuses: yoreselIsletmeStatusesInitial([isletme._id], 'approved'),
      note,
      status: 'approved',
      manualEntry: true,
    });
    res.status(201).json({ message: 'Manuel rezervasyon eklendi', talep: talep.toObject() });
  } catch (e) {
    console.error('Yoresel isletme manual talep error:', e);
    res.status(500).json({ error: 'Kayıt oluşturulamadı', message: e.message });
  }
});

// Yöresel işletme paneli: duyurular (mekân bazlı değil; giriş hesabı / grup bazlı)
app.get('/api/yoresel-isletme/:isletmeId/duyurular', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(isletmeId)) return res.status(400).json({ error: 'Geçersiz işletme' });
    const loginName = String(req.query.loginName || '').trim();
    const isletme = await loadYoreselIsletmeIfAllowed(isletmeId, loginName);
    if (!isletme) return res.status(403).json({ error: 'Yetkisiz veya geçersiz işletme' });
    const scope = await yoreselDuyuruFindQuery(isletme, loginName);
    const list = await Duyuru.find(scope).sort({ createdAt: -1 }).lean();
    res.json({ list });
  } catch (e) {
    console.error('Yoresel isletme duyurular list error:', e);
    res.status(500).json({ error: 'Duyurular alınamadı', list: [] });
  }
});

app.post('/api/yoresel-isletme/:isletmeId/duyurular', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(isletmeId)) return res.status(400).json({ error: 'Geçersiz işletme' });
    const loginName = String(req.body?.loginName || '').trim();
    const isletme = await loadYoreselIsletmeIfAllowed(isletmeId, loginName);
    if (!isletme) return res.status(403).json({ error: 'Yetkisiz veya geçersiz işletme' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Başlık gerekli' });
    const licenseExpiry = String(req.body?.licenseExpiry ?? isletme.licenseExpiry ?? '').trim();
    if (licenseExpiry) {
      const licErr = validateLicenseExpiryNotBeforeToday(licenseExpiry);
      if (licErr) return res.status(400).json({ error: licErr });
    }
    const districtTrim =
      String(req.body?.addressDistrict || '').trim() || (await yoreselRegisteredDistrict(isletme));
    const ownerLoginName = yoreselOwnerLoginName(isletme, loginName);
    const doc = await Duyuru.create({
      title,
      description: String(req.body?.description || '').trim(),
      yoreselIsletme: null,
      yoreselLoginGroupId: String(isletme.loginGroupId || '').trim(),
      yoreselLoginName: ownerLoginName,
      yoreselPhone: String(isletme.phone || '').trim(),
      business: null,
      address: {
        city: String(req.body?.addressCity ?? isletme.address?.city ?? '').trim(),
        district: districtTrim,
        neighborhood: String(req.body?.addressNeighborhood ?? '').trim(),
      },
      startDate: String(req.body?.startDate || '').trim(),
      endDate: String(req.body?.endDate || '').trim(),
      active: req.body?.active !== false,
      licenseExpiry,
      imageUrl: String(req.body?.imageUrl || '').trim(),
    });
    res.status(201).json({ message: 'Duyuru paylaşıldı', duyuru: doc.toObject() });
  } catch (e) {
    console.error('Yoresel isletme duyuru create error:', e);
    res.status(500).json({ error: 'Duyuru paylaşılamadı', message: e.message });
  }
});

app.patch('/api/yoresel-isletme/:isletmeId/duyurular/:duyuruId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId, duyuruId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(isletmeId) || !mongoose.Types.ObjectId.isValid(duyuruId)) {
      return res.status(400).json({ error: 'Geçersiz id' });
    }
    const loginName = String(req.body?.loginName || '').trim();
    const isletme = await loadYoreselIsletmeIfAllowed(isletmeId, loginName);
    if (!isletme) return res.status(403).json({ error: 'Yetkisiz veya geçersiz işletme' });
    const scope = await yoreselDuyuruFindQuery(isletme, loginName);
    const duyuru = await Duyuru.findOne({ _id: duyuruId, ...scope });
    if (!duyuru) return res.status(404).json({ error: 'Duyuru bulunamadı' });
    const set = {};
    if (req.body?.title !== undefined) {
      const t = String(req.body.title || '').trim();
      if (!t) return res.status(400).json({ error: 'Başlık boş olamaz' });
      set.title = t;
    }
    if (req.body?.description !== undefined) set.description = String(req.body.description || '').trim();
    if (req.body?.startDate !== undefined) set.startDate = String(req.body.startDate || '').trim();
    if (req.body?.endDate !== undefined) set.endDate = String(req.body.endDate || '').trim();
    if (req.body?.active !== undefined) set.active = req.body.active !== false;
    if (req.body?.licenseExpiry !== undefined) {
      const licenseExpiry = String(req.body.licenseExpiry || '').trim();
      if (licenseExpiry) {
        const licErr = validateLicenseExpiryNotBeforeToday(licenseExpiry);
        if (licErr) return res.status(400).json({ error: licErr });
      }
      set.licenseExpiry = licenseExpiry;
    }
    if (req.body?.imageUrl !== undefined) set.imageUrl = String(req.body.imageUrl || '').trim();
    if (
      req.body?.addressCity !== undefined
      || req.body?.addressDistrict !== undefined
      || req.body?.addressNeighborhood !== undefined
    ) {
      const districtTrim =
        String(req.body?.addressDistrict ?? duyuru.address?.district ?? '').trim()
        || (await yoreselRegisteredDistrict(isletme));
      set.address = {
        city: String(req.body?.addressCity ?? duyuru.address?.city ?? isletme.address?.city ?? '').trim(),
        district: districtTrim,
        neighborhood: String(
          req.body?.addressNeighborhood ?? duyuru.address?.neighborhood ?? ''
        ).trim(),
      };
    }
    const updated = await Duyuru.findByIdAndUpdate(duyuruId, { $set: set }, { new: true }).lean();
    res.json({ message: 'Duyuru güncellendi', duyuru: updated });
  } catch (e) {
    console.error('Yoresel isletme duyuru update error:', e);
    res.status(500).json({ error: 'Duyuru güncellenemedi', message: e.message });
  }
});

app.delete('/api/yoresel-isletme/:isletmeId/duyurular/:duyuruId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { isletmeId, duyuruId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(isletmeId) || !mongoose.Types.ObjectId.isValid(duyuruId)) {
      return res.status(400).json({ error: 'Geçersiz id' });
    }
    const loginName = String(req.query.loginName || req.body?.loginName || '').trim();
    const isletme = await loadYoreselIsletmeIfAllowed(isletmeId, loginName);
    if (!isletme) return res.status(403).json({ error: 'Yetkisiz veya geçersiz işletme' });
    const scope = await yoreselDuyuruFindQuery(isletme, loginName);
    const duyuru = await Duyuru.findOne({ _id: duyuruId, ...scope });
    if (!duyuru) return res.status(404).json({ error: 'Duyuru bulunamadı' });
    await Duyuru.findByIdAndDelete(duyuruId);
    res.json({ message: 'Duyuru silindi' });
  } catch (e) {
    console.error('Yoresel isletme duyuru delete error:', e);
    res.status(500).json({ error: 'Duyuru silinemedi', message: e.message });
  }
});

// Kullanıcı: Çekici listesi (il/ilçe/mahalle filtreli)
app.get('/api/cekici', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Cekici);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const query = {};
    mergeAddressStringFilters(query, city, district, neighborhood);
    let list = await Cekici.find(query).sort({ companyName: 1 }).lean();
    if (req.query.forMap === '1' || req.query.forMap === 'true') {
      list = await enrichListForMap(list, { forMap: true, Model: Cekici });
    }
    list = enrichListingMediaList(list);
    res.json({ list });
  } catch (error) {
    console.error('Cekici list error:', error);
    res.status(500).json({ error: 'Çekici listesi alınamadı', message: error.message });
  }
});

// Kullanıcı: Lastikçi listesi (il/ilçe/mahalle filtreli)
app.get('/api/lastikci', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Lastikci);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const query = {};
    mergeAddressStringFilters(query, city, district, neighborhood);
    let list = await Lastikci.find(query).sort({ name: 1 }).lean();
    if (req.query.forMap === '1' || req.query.forMap === 'true') {
      list = await enrichListForMap(list, { forMap: true, Model: Lastikci });
    }
    list = enrichListingMediaList(list);
    res.json({ list });
  } catch (error) {
    console.error('Lastikci list error:', error);
    res.status(500).json({ error: 'Lastikçi listesi alınamadı', message: error.message });
  }
});

// Kullanıcı: Taksi listesi (il/ilçe/mahalle filtreli)
app.get('/api/taksi', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Taksi);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const query = {};
    mergeAddressStringFilters(query, city, district, neighborhood);
    let list = await Taksi.find(query).sort({ companyName: 1 }).lean();
    if (req.query.forMap === '1' || req.query.forMap === 'true') {
      list = await enrichListForMap(list, { forMap: true, Model: Taksi });
    }
    list = enrichListingMediaList(list);
    res.json({ list });
  } catch (error) {
    console.error('Taksi list error:', error);
    res.status(500).json({ error: 'Taksi listesi alınamadı', message: error.message });
  }
});

// Kullanıcı: Kampanyalar / Duyurular (il/ilçe/mahalle filtreli)
app.get('/api/kampanyalar', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Kampanya);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    // Admin ile aynı: yalnızca listType 'kampanya' (Kampanya koleksiyonunda 'duyuru' tipi veya eski kayıtlar kullanıcıda fazladan görünmesin)
    const query = { active: { $ne: false }, listType: 'kampanya' };
    let list = await Kampanya.find(query)
      .populate('business', 'businessName phone address')
      .sort({ createdAt: -1 })
      .lean();
    list = await enrichPremiumOwnerListItems(list, { kind: 'kampanya' });
    list = filterListByAddress(list, city, district, neighborhood);
    res.json({ list });
  } catch (error) {
    console.error('Kampanyalar list error:', error);
    res.status(500).json({ error: 'Kampanyalar alınamadı', message: error.message });
  }
});

// Kullanıcı: Duyurular (admin Duyuru koleksiyonu; il/ilçe/mahalle filtreli)
app.get('/api/duyurular', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Duyuru);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const query = { active: { $ne: false } };
    let list = await Duyuru.find(query)
      .populate('business', 'businessName address')
      .populate('yoreselIsletme', 'loginName name phone address')
      .sort({ createdAt: -1 })
      .lean();
    list = filterListByAddress(list, city, district, neighborhood);
    res.json({ list });
  } catch (error) {
    console.error('Duyurular list error:', error);
    res.status(500).json({ error: 'Duyurular alınamadı', message: error.message });
  }
});

// Kullanıcı: İş ilanları (il/ilçe/mahalle filtreli)
app.get('/api/isilanlari', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(IsIlani);
    const city = req.query.city != null ? String(req.query.city).trim() : '';
    const district = req.query.district != null ? String(req.query.district).trim() : '';
    const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
    const query = { active: { $ne: false } };
    let list = await IsIlani.find(query).sort({ createdAt: -1 }).lean();
    list = await enrichPremiumOwnerListItems(list, { kind: 'isilan' });
    list = filterListByAddress(list, city, district, neighborhood);
    res.json({ list });
  } catch (error) {
    console.error('İş ilanları list error:', error);
    res.status(500).json({ error: 'İş ilanları alınamadı', message: error.message });
  }
});

// Kullanıcının kendi rezervasyonları (profil sayfası)
app.get('/api/user/reservations', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId gerekli', reservations: [] });
    }
    const list = await Reservation.find({ user: userId })
      .sort({ date: 1, slot: 1 })
      .populate('business', 'businessName')
      .lean();
    res.json({ reservations: list });
  } catch (error) {
    console.error('User reservations error:', error);
    res.status(500).json({ error: 'Rezervasyonlar alınamadı', reservations: [], message: error.message });
  }
});

// Kullanıcı: yöresel etkinlik talepleri (çoklu hizmet satırları + işletme bazlı durum)
app.get('/api/user/yoresel-talepler', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok', talepler: [] });
    }
    const userId = req.query.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId).trim())) {
      return res.status(400).json({ error: 'Geçerli userId gerekli', talepler: [] });
    }
    const uid = String(userId).trim();
    const talepler = await YoreselEtkinlikTalep.find({ user: uid })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    const idSet = new Set();
    talepler.forEach((t) => {
      (t.allTargetIsletmeler || []).forEach((x) => idSet.add(String(x)));
    });
    const ids = [...idSet].filter((x) => mongoose.Types.ObjectId.isValid(x)).map((x) => new mongoose.Types.ObjectId(x));
    const isims = ids.length
      ? await YoreselEtkinlikIsletme.find({ _id: { $in: ids } }).select('name').lean()
      : [];
    const nameById = Object.fromEntries(isims.map((n) => [String(n._id), n.name || 'İşletme']));
    const enriched = talepler.map((t) => {
      const serviceLines = [];
      const keys = ['muzisyen', 'asci', 'susleme', 'zurna', 'parkSalon', 'mekan', 'kuafor', 'aracKiralama'];
      keys.forEach((key) => {
        if (!t.services || !t.services[key]) return;
        const issId = t.serviceTargets && t.serviceTargets[key];
        const sid = issId != null ? String(issId) : '';
        const slot = yoreselTimeSlotForService(t, key);
        serviceLines.push({
          serviceKey: key,
          label: YORESEL_SERVICE_LABELS[key] || key,
          isletmeId: sid || null,
          isletmeName: sid ? (nameById[sid] || 'İşletme') : 'İşletme atanmadı',
          status: sid ? yoreselEffectiveStatusForIsletme(t, sid) : 'pending',
          timeSlot: slot,
          timeSlotLabel: YORESEL_TIME_SLOT_LABELS[slot] || slot,
        });
      });
      const slotLabels = serviceLines.map((l) => l.timeSlotLabel);
      const uniqueSlotLabels = [...new Set(slotLabels)];
      return {
        ...t,
        eventTypeLabel: YORESEL_EVENT_LABELS[t.eventType] || t.eventType,
        timeSlotLabel: uniqueSlotLabels.length === 1
          ? uniqueSlotLabels[0]
          : uniqueSlotLabels.length > 1
            ? uniqueSlotLabels.join(' · ')
            : YORESEL_TIME_SLOT_LABELS[normalizeYoreselTimeSlot(t.timeSlot)] || t.timeSlot,
        serviceLines,
        aggregateStatus: t.status,
      };
    });
    res.json({ talepler: enriched });
  } catch (error) {
    console.error('User yoresel talepler error:', error);
    res.status(500).json({ error: 'Talepler alınamadı', talepler: [], message: error.message });
  }
});

// İşletme menü bilgisi ve güncelleme (reservations'tan önce tanımlanmalı, yoksa :id "menu" ile eşleşir)
app.get('/api/business/:businessId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const business = await Business.findById(req.params.businessId)
      .select('businessName menuPdfUrl menuImageUrl mediaFiles imageUrl activityField openingHours limanCikisSaati limanGelisSaati reservationClosedDates premium address phone')
      .lean();
    if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
    res.json({ business: enrichListingMedia(business) });
  } catch (e) {
    console.error('Business get error:', e);
    res.status(500).json({ error: 'İşletme bilgisi alınamadı', message: e.message });
  }
});

app.patch('/api/business/:businessId/menu', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { businessId } = req.params;
    const set = {};
    applyMediaFilesToSet(set, req.body);
    if (req.body?.menuPdfUrl !== undefined) set.menuPdfUrl = String(req.body.menuPdfUrl || '').trim();
    if (req.body?.menuImageUrl !== undefined) set.menuImageUrl = String(req.body.menuImageUrl || '').trim();
    if (set.menuImageUrl && !set.imageUrl) set.imageUrl = set.menuImageUrl;
    const business = await Business.findByIdAndUpdate(businessId, { $set: set }, { new: true }).select(
      'menuPdfUrl menuImageUrl mediaFiles imageUrl'
    ).lean();
    if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
    res.json({ message: 'Menü güncellendi', business: enrichListingMedia(business) });
  } catch (e) {
    console.error('Menu update error:', e);
    res.status(500).json({ error: 'Menü güncellenemedi', message: e.message });
  }
});

app.get('/api/business/:businessId/reservation-availability', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const dateStr = normalizeReservationDateStr(req.query.date);
    if (!dateStr) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) gerekli' });
    }
    const business = await Business.findById(req.params.businessId)
      .select('activityField openingHours limanCikisSaati reservationClosedDates')
      .lean();
    if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
    const manuallyClosed = isDateManuallyClosed(business, dateStr);
    const hours = getOpeningHoursForDate(business, dateStr);
    const slots = getReservationSlotsForBusiness(business, dateStr);
    res.json({
      date: dateStr,
      slots,
      manuallyClosed,
      closed: slots.length === 0,
      openingHours: hours,
    });
  } catch (e) {
    console.error('Reservation availability error:', e);
    res.status(500).json({ error: 'Müsaitlik alınamadı', message: e.message });
  }
});

app.patch('/api/business/:businessId/reservation-closed-dates', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const dateStr = normalizeReservationDateStr(req.body?.date);
    if (!dateStr) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) gerekli' });
    }
    const closed = req.body?.closed !== false && req.body?.closed !== 'false';
    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });

    let dates = sanitizeClosedDatesList(business.reservationClosedDates);
    if (closed) {
      if (!dates.includes(dateStr)) dates.push(dateStr);
    } else {
      dates = dates.filter((d) => d !== dateStr);
    }
    dates = sanitizeClosedDatesList(dates);
    business.reservationClosedDates = dates;
    await business.save();

    res.json({
      message: closed ? 'Gün rezervasyona kapatıldı' : 'Gün rezervasyona açıldı',
      date: dateStr,
      closed: dates.includes(dateStr),
      reservationClosedDates: dates,
    });
  } catch (e) {
    console.error('Reservation closed dates error:', e);
    res.status(500).json({ error: 'Güncellenemedi', message: e.message });
  }
});

// İşletme rezervasyonları: tarihe göre (bugün/gelecek: onaylı slotlar, geçmiş: başarılı/başarısız)
app.get('/api/business/:businessId/reservations', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { businessId } = req.params;
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) gerekli' });
    }
    const list = await Reservation.find({
      business: businessId,
      date: String(date).trim(),
    })
      .sort({ slot: 1 })
      .populate('user', 'name surname username phone')
      .lean();
    res.json({ reservations: list });
  } catch (error) {
    console.error('Reservations by date error:', error);
    res.status(500).json({ error: 'Rezervasyonlar alınamadı', message: error.message });
  }
});

// Bekleyen onaylar
app.get('/api/business/:businessId/reservations/pending', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { businessId } = req.params;
    const list = await Reservation.find({
      business: businessId,
      status: 'pending',
    })
      .sort({ date: 1, slot: 1 })
      .populate('user', 'name surname username phone')
      .lean();
    res.json({ reservations: list });
  } catch (error) {
    console.error('Pending reservations error:', error);
    res.status(500).json({ error: 'Bekleyen rezervasyonlar alınamadı', message: error.message });
  }
});

// Rezervasyon oluştur (kullanıcı veya misafir)
app.post('/api/reservations', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { businessId, userId, guestName, guestPhone, date, slot, note, countAge0to6, countAge6to12, countAge12Plus } = req.body;
    if (!businessId || !date || !slot) {
      return res.status(400).json({ error: 'businessId, date (YYYY-MM-DD) ve slot (HH:mm) zorunludur' });
    }
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ error: 'İşletme bulunamadı' });
    }
    const normalizedDate = String(date).trim();
    const normalizedSlot = String(slot).trim();
    if (isDateManuallyClosed(business, normalizedDate)) {
      return res.status(400).json({ error: 'Bu tarih işletme tarafından rezervasyona kapalı.' });
    }
    if (!isSlotAllowedForBusiness(business, normalizedDate, normalizedSlot)) {
      return res.status(400).json({ error: 'Seçilen saat işletmenin açılış-kapanış saatleri dışında veya kapalı bir gün.' });
    }
    const reservation = new Reservation({
      business: businessId,
      user: userId || null,
      guestName: (guestName || '').trim(),
      guestPhone: phoneDigitsOnly(guestPhone),
      date: normalizedDate,
      slot: normalizedSlot,
      note: (note || '').trim(),
      countAge0to6: Math.max(0, parseInt(countAge0to6, 10) || 0),
      countAge6to12: Math.max(0, parseInt(countAge6to12, 10) || 0),
      countAge12Plus: Math.max(0, parseInt(countAge12Plus, 10) || 0),
      status: 'pending',
    });
    await reservation.save();
    await reservation.populate('user', 'name surname');
    res.status(201).json({
      message: 'Rezervasyon talebi oluşturuldu',
      reservation: reservation.toObject(),
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Rezervasyon oluşturulamadı', message: error.message });
  }
});

// Kullanıcı rezervasyon iptal et (sadece kendi pending/approved, bugun ve sonrası)
app.patch('/api/user/reservations/:id/cancel', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { id } = req.params;
    const userId = String(req.body?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'userId gerekli' });
    }
    const reservation = await Reservation.findOne({ _id: id, user: userId });
    if (!reservation) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı' });
    }
    if (!['pending', 'approved'].includes(reservation.status)) {
      return res.status(400).json({ error: 'Bu rezervasyon artık iptal edilemez' });
    }
    const todayStr = getTodayLocalStr();
    if (String(reservation.date || '').trim() < todayStr) {
      return res.status(400).json({ error: 'Geçmiş rezervasyon iptal edilemez' });
    }
    reservation.status = 'cancelled';
    await reservation.save();
    res.json({
      message: 'Rezervasyon iptal edildi',
      reservation: await Reservation.findById(id).populate('business', 'businessName').lean(),
    });
  } catch (error) {
    console.error('User cancel reservation error:', error);
    res.status(500).json({ error: 'Rezervasyon iptal edilemedi', message: error.message });
  }
});

// Rezervasyon onayla / reddet
app.patch('/api/business/:businessId/reservations/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { businessId, id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status: approved veya rejected olmalı' });
    }
    const reservation = await Reservation.findOne({
      _id: id,
      business: businessId,
      status: 'pending',
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı veya zaten işlendi' });
    }
    reservation.status = status;
    await reservation.save();
    res.json({
      message: status === 'approved' ? 'Rezervasyon onaylandı' : 'Rezervasyon reddedildi',
      reservation: await Reservation.findById(id).populate('user', 'name surname').lean(),
    });
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({ error: 'Güncelleme yapılamadı', message: error.message });
  }
});

// Onaylanmış rezervasyonda giriş oldu / giriş olmadı
app.patch('/api/business/:businessId/reservations/:id/attendance', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { businessId, id } = req.params;
    const { attendance } = req.body;
    if (!['completed', 'no_show'].includes(attendance)) {
      return res.status(400).json({ error: 'attendance: completed (giriş oldu) veya no_show (giriş olmadı) olmalı' });
    }
    const reservation = await Reservation.findOne({
      _id: id,
      business: businessId,
      status: 'approved',
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı veya onaylı değil' });
    }
    reservation.status = attendance;
    await reservation.save();
    res.json({
      message: attendance === 'completed' ? 'Giriş kaydedildi' : 'Giriş yapılmadı olarak kaydedildi',
      reservation: await Reservation.findById(id).populate('user', 'name surname phone').lean(),
    });
  } catch (error) {
    console.error('Attendance update error:', error);
    res.status(500).json({ error: 'Güncelleme yapılamadı', message: error.message });
  }
});

/** Admin: kullanıcılar + bu yıl/ay rezervasyon istatistikleri */
app.get('/api/admin/users-reservation-stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const FAIL_STATUSES = ['rejected', 'no_show', 'cancelled'];

    const users = await User.find().select('name surname username memberId phone').sort({ createdAt: -1 });
    const usersNeedingMemberId = users.filter(
      (u) => !u.memberId || !isValidMemberIdFormat(u.memberId)
    );
    await Promise.all(usersNeedingMemberId.map((u) => ensureUserMemberId(u)));

    const statsRows = await Reservation.aggregate([
      { $match: { user: { $ne: null } } },
      {
        $group: {
          _id: '$user',
          yearTotal: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$date', yearStart] }, { $lte: ['$date', yearEnd] }] },
                1,
                0,
              ],
            },
          },
          monthTotal: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$date', monthStart] }, { $lte: ['$date', monthEnd] }] },
                1,
                0,
              ],
            },
          },
          yearSuccess: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$date', yearStart] },
                    { $lte: ['$date', yearEnd] },
                    { $eq: ['$status', 'completed'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          yearFail: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$date', yearStart] },
                    { $lte: ['$date', yearEnd] },
                    { $in: ['$status', FAIL_STATUSES] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const statsByUserId = new Map(
      statsRows.map((row) => [String(row._id), row])
    );

    const list = users.map((u) => {
      const sid = String(u._id);
      const st = statsByUserId.get(sid);
      return {
        id: sid,
        memberId: u.memberId ? normalizeMemberId(u.memberId) : '',
        name: u.name || '',
        surname: u.surname || '',
        username: u.username || '',
        phone: u.phone || '',
        displayName: [u.name, u.surname].filter(Boolean).join(' ') || u.username || '—',
        stats: {
          yearTotal: st?.yearTotal ?? 0,
          monthTotal: st?.monthTotal ?? 0,
          yearSuccess: st?.yearSuccess ?? 0,
          yearFail: st?.yearFail ?? 0,
        },
      };
    });

    res.json({
      year,
      month,
      periodLabel: `${year} yılı / ${month}. ay`,
      users: list,
    });
  } catch (error) {
    console.error('Admin users reservation stats error:', error);
    res.status(500).json({ error: 'Kullanıcı listesi alınamadı', message: error.message });
  }
});

/** Admin: indirim / üye indirimi için işletme seçici (hafif liste) */
app.get('/api/admin/businesses-picker', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const rows = await Business.find({})
      .select('businessName approved')
      .sort({ businessName: 1 })
      .lean();
    const list = rows.map((b) => {
      const name = (b.businessName && String(b.businessName).trim()) || String(b._id);
      const suffix = b.approved === false ? ' (onaysız)' : '';
      return { id: String(b._id), label: name + suffix };
    });
    res.json({ list, count: list.length });
  } catch (error) {
    console.error('Admin businesses picker error:', error);
    res.status(500).json({ error: 'İşletme listesi alınamadı', message: error.message });
  }
});

/** Admin: kullanıcılar il / ilçe / mahalle dağılımı */
app.get('/api/admin/users-by-address', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const UNKNOWN = 'Belirtilmemiş';
    const users = await User.find()
      .select('name surname username memberId phone address')
      .sort({ 'address.city': 1, 'address.district': 1, 'address.neighborhood': 1, name: 1 });

    for (const u of users) {
      await ensureUserMemberId(u);
    }

    const cityMap = new Map();

    const toUserRow = (u) => ({
      id: String(u._id),
      memberId: u.memberId ? normalizeMemberId(u.memberId) : '',
      name: u.name || '',
      surname: u.surname || '',
      username: u.username || '',
      phone: u.phone || '',
      displayName: [u.name, u.surname].filter(Boolean).join(' ') || u.username || '—',
    });

    for (const u of users) {
      const city = (u.address?.city && String(u.address.city).trim()) || UNKNOWN;
      const district = (u.address?.district && String(u.address.district).trim()) || UNKNOWN;
      const neighborhood = (u.address?.neighborhood && String(u.address.neighborhood).trim()) || UNKNOWN;

      if (!cityMap.has(city)) cityMap.set(city, new Map());
      const districtMap = cityMap.get(city);
      if (!districtMap.has(district)) districtMap.set(district, new Map());
      const neighborhoodMap = districtMap.get(district);
      if (!neighborhoodMap.has(neighborhood)) neighborhoodMap.set(neighborhood, []);
      neighborhoodMap.get(neighborhood).push(toUserRow(u));
    }

    const sortTr = (a, b) => String(a).localeCompare(String(b), 'tr');
    const tree = [];
    const districtKeys = new Set();
    const neighborhoodKeys = new Set();

    [...cityMap.keys()].sort(sortTr).forEach((city) => {
      const districtMap = cityMap.get(city);
      const districts = [];
      let cityCount = 0;

      [...districtMap.keys()].sort(sortTr).forEach((district) => {
        districtKeys.add(`${city}\0${district}`);
        const neighborhoodMap = districtMap.get(district);
        const neighborhoods = [];
        let districtCount = 0;

        [...neighborhoodMap.keys()].sort(sortTr).forEach((neighborhood) => {
          neighborhoodKeys.add(`${city}\0${district}\0${neighborhood}`);
          const userList = neighborhoodMap.get(neighborhood);
          userList.sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
          districtCount += userList.length;
          neighborhoods.push({
            neighborhood,
            count: userList.length,
            users: userList,
          });
        });

        cityCount += districtCount;
        districts.push({ district, count: districtCount, neighborhoods });
      });

      tree.push({ city, count: cityCount, districts });
    });

    res.json({
      totalUsers: users.length,
      summary: {
        cityCount: cityMap.size,
        districtCount: districtKeys.size,
        neighborhoodCount: neighborhoodKeys.size,
      },
      tree,
    });
  } catch (error) {
    console.error('Admin users by address error:', error);
    res.status(500).json({ error: 'Adres dağılımı alınamadı', message: error.message });
  }
});

// Bekleyen işletme kayıtları (uygulama üzerinden kayıt, onay bekliyor)
app.get('/api/admin/pending-businesses', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const list = await Business.find({ approved: { $ne: true } }).select('-password').sort({ createdAt: -1 }).lean();
    res.json({ list });
  } catch (e) {
    console.error('Pending businesses error:', e);
    res.status(500).json({ error: 'Liste alınamadı', message: e.message });
  }
});

app.post('/api/admin/approve-business/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { $set: { approved: true } },
      { new: true }
    ).select('-password');
    if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
    res.json({ message: 'İşletme onaylandı', business });
  } catch (e) {
    console.error('Approve business error:', e);
    res.status(500).json({ error: 'Onaylama başarısız', message: e.message });
  }
});

app.post('/api/admin/reject-business/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const business = await Business.findByIdAndDelete(req.params.id);
    if (!business) return res.status(404).json({ error: 'İşletme bulunamadı' });
    res.json({ message: 'Kayıt reddedildi' });
  } catch (e) {
    console.error('Reject business error:', e);
    res.status(500).json({ error: 'Reddetme başarısız', message: e.message });
  }
});

// ---------- Admin API (İşletme, Esnaf, Kampanyalar, Çekici, Lastikçi) ----------
const adminListHandlers = {
  isletme: {
    list: () => Business.find({ approved: true }).select('-password').lean(),
    add: async (body) => {
      const p = body.password || 'default123';
      const address = (body.address && typeof body.address === 'object')
        ? { city: String(body.address.city || 'Muğla').trim(), district: String(body.address.district || '').trim(), neighborhood: String(body.address.neighborhood || '').trim() }
        : { city: (body.addressCity || 'Muğla').trim(), district: (body.addressDistrict || '').trim(), neighborhood: (body.addressNeighborhood || '').trim() };
      const openingHours = (body.openingHours && typeof body.openingHours === 'object')
        ? {
            weekdays: { open: String(body.openingHours.weekdays?.open || 'Kapalı').trim(), close: String(body.openingHours.weekdays?.close || '').trim() },
            weekend: { open: String(body.openingHours.weekend?.open || 'Kapalı').trim(), close: String(body.openingHours.weekend?.close || '').trim() },
          }
        : {
            weekdays: { open: (body.weekdaysOpen || 'Kapalı').trim(), close: (body.weekdaysClose || '').trim() },
            weekend: { open: (body.weekendOpen || 'Kapalı').trim(), close: (body.weekendClose || '').trim() },
          };
      const loc = await resolveLocationFieldsFromBody(body, address);
      const hash = await bcrypt.hash(p, 10);
      const createDoc = {
          businessName: (body.businessName || body.name || 'İşletme').trim(),
          password: hash,
          phone: (body.phone || '').trim(),
          activityField: (body.activityField || 'restorant').trim(),
          address,
          openingHours,
          googleLocation: loc.googleLocation,
          latitude: loc.latitude,
          longitude: loc.longitude,
          mapLocationSource: loc.mapLocationSource,
          menuPdfUrl: (body.menuPdfUrl || '').trim(),
          menuImageUrl: (body.menuImageUrl || '').trim(),
          googleReviewLink: (body.googleReviewLink || '').trim(),
          website: (body.website || '').trim(),
          instagram: (body.instagram || '').trim(),
          hasChargingStation: !!body.hasChargingStation,
          hasFreeParking: !!body.hasFreeParking,
          hasFreeValet: !!body.hasFreeValet,
          hasPaidParking: !!body.hasPaidParking,
          hasPaidValet: !!body.hasPaidValet,
          imageUrl: (body.imageUrl || '').trim(),
          licenseExpiry: (body.licenseExpiry || '').trim(),
          approved: true,
          limanCikisSaati: (body.limanCikisSaati != null ? String(body.limanCikisSaati) : '').trim(),
          limanGelisSaati: (body.limanGelisSaati != null ? String(body.limanGelisSaati) : '').trim(),
          premium: body.premium === true,
        };
      applyMediaFilesToSet(createDoc, body);
      return Business.create(createDoc);
    },
    update: async (id, body) => {
      const licenseExpiry = (body.licenseExpiry != null ? String(body.licenseExpiry) : '').trim();
      const set = { ...body };
      if (set.premium !== undefined) set.premium = body.premium === true;
      if (set.password && String(set.password).length >= 6) {
        set.password = await bcrypt.hash(set.password, 10);
      } else {
        delete set.password;
      }
      set.licenseExpiry = licenseExpiry;
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? 'Muğla').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      const address = set.address || body.address;
      const loc = await resolveLocationFieldsFromBody({ ...body, address }, address);
      Object.assign(set, loc);
      applyMediaFilesToSet(set, body);
      return Business.findByIdAndUpdate(id, { $set: set }, { new: true }).select('-password');
    },
    delete: (id) => Business.findByIdAndDelete(id),
  },
  esnaf: {
    list: () => Esnaf.find().lean(),
    add: async (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || 'Muğla').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      const loc = await resolveLocationFieldsFromBody(body, address);
      const premium = body.premium === true;
      let passwordHash = '';
      if (premium) {
        const fields = await listingPremiumCreateFields(body);
        passwordHash = fields.password;
      }
      const createDoc = {
        name: String(body.name || '').trim(),
        phone: phoneDigitsOnly(body.phone || ''),
        category: String(body.category || '').trim(),
        description: String(body.description || '').trim(),
        address,
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
        openingHours: openingHoursFromBody(body),
        menuPdfUrl: (body.menuPdfUrl || '').trim(),
        menuImageUrl: (body.menuImageUrl || '').trim(),
        premium,
        password: passwordHash,
        ...loc,
      };
      applyMediaFilesToSet(createDoc, body);
      return Esnaf.create(createDoc);
    },
    update: async (id, body) => {
      const set = { ...body };
      await applyListingPremiumUpdateFields(set, body);
      if (set.phone !== undefined) set.phone = phoneDigitsOnly(set.phone || '');
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? 'Muğla').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      const loc = await resolveLocationFieldsFromBody(
        { ...body, address: set.address },
        set.address || body.address
      );
      Object.assign(set, loc);
      applyOpeningHoursAndMenuToSet(set, body);
      return Esnaf.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => Esnaf.findByIdAndDelete(id),
  },
  kampanyalar: {
    list: () => Kampanya.find({ listType: 'kampanya' }).populate('business', 'businessName phone').lean(),
    add: (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || '').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      return Kampanya.create({
        listType: 'kampanya',
        title: String(body.title || '').trim(),
        description: '',
        companyName: String(body.companyName || '').trim(),
        contactPhone: String(body.contactPhone || '').trim(),
        business: body.business || null,
        address,
        startDate: String(body.startDate || '').trim(),
        endDate: String(body.endDate || '').trim(),
        discountText: String(body.discountText || '').trim(),
        active: body.active !== false,
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
      });
    },
    update: (id, body) => {
      const set = { ...body, listType: 'kampanya' };
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? '').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      return Kampanya.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => Kampanya.findByIdAndDelete(id),
  },
  cekici: {
    list: () => Cekici.find().lean(),
    add: async (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || 'Muğla').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      const loc = await resolveLocationFieldsFromBody(body, address);
      const { premium, password } = await listingPremiumCreateFields(body);
      const createDoc = {
        companyName: String(body.companyName || '').trim(),
        phone: phoneDigitsOnly(body.phone || ''),
        address,
        notes: String(body.notes || '').trim(),
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
        openingHours: openingHoursFromBody(body),
        menuPdfUrl: (body.menuPdfUrl || '').trim(),
        menuImageUrl: (body.menuImageUrl || '').trim(),
        premium,
        password,
        ...loc,
      };
      applyMediaFilesToSet(createDoc, body);
      return Cekici.create(createDoc);
    },
    update: async (id, body) => {
      const set = { ...body };
      await applyListingPremiumUpdateFields(set, body);
      if (set.phone !== undefined) set.phone = phoneDigitsOnly(set.phone || '');
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? 'Muğla').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      const loc = await resolveLocationFieldsFromBody(
        { ...body, address: set.address },
        set.address || body.address
      );
      Object.assign(set, loc);
      applyOpeningHoursAndMenuToSet(set, body);
      return Cekici.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => Cekici.findByIdAndDelete(id),
  },
  lastikci: {
    list: () => Lastikci.find().lean(),
    add: async (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || 'Muğla').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      const loc = await resolveLocationFieldsFromBody(body, address);
      const { premium, password } = await listingPremiumCreateFields(body);
      const createDoc = {
        name: String(body.name || '').trim(),
        phone: phoneDigitsOnly(body.phone || ''),
        address,
        notes: String(body.notes || '').trim(),
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
        openingHours: openingHoursFromBody(body),
        menuPdfUrl: (body.menuPdfUrl || '').trim(),
        menuImageUrl: (body.menuImageUrl || '').trim(),
        premium,
        password,
        ...loc,
      };
      applyMediaFilesToSet(createDoc, body);
      return Lastikci.create(createDoc);
    },
    update: async (id, body) => {
      const set = { ...body };
      await applyListingPremiumUpdateFields(set, body);
      if (set.phone !== undefined) set.phone = phoneDigitsOnly(set.phone || '');
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? 'Muğla').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      const loc = await resolveLocationFieldsFromBody(
        { ...body, address: set.address },
        set.address || body.address
      );
      Object.assign(set, loc);
      applyOpeningHoursAndMenuToSet(set, body);
      return Lastikci.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => Lastikci.findByIdAndDelete(id),
  },
  taksi: {
    list: () => Taksi.find().lean(),
    add: async (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || 'Muğla').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      const loc = await resolveLocationFieldsFromBody(body, address);
      const { premium, password } = await listingPremiumCreateFields(body);
      const createDoc = {
        companyName: String(body.companyName || '').trim(),
        phone: phoneDigitsOnly(body.phone || ''),
        address,
        notes: String(body.notes || '').trim(),
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
        openingHours: openingHoursFromBody(body),
        menuPdfUrl: (body.menuPdfUrl || '').trim(),
        menuImageUrl: (body.menuImageUrl || '').trim(),
        premium,
        password,
        ...loc,
      };
      applyMediaFilesToSet(createDoc, body);
      return Taksi.create(createDoc);
    },
    update: async (id, body) => {
      const set = { ...body };
      await applyListingPremiumUpdateFields(set, body);
      if (set.phone !== undefined) set.phone = phoneDigitsOnly(set.phone || '');
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? 'Muğla').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      const loc = await resolveLocationFieldsFromBody(
        { ...body, address: set.address },
        set.address || body.address
      );
      Object.assign(set, loc);
      applyOpeningHoursAndMenuToSet(set, body);
      return Taksi.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => Taksi.findByIdAndDelete(id),
  },
  duyurular: {
    list: () => Duyuru.find().populate('business', 'businessName').populate('yoreselIsletme', 'loginName name phone').lean(),
    add: (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || '').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      return Duyuru.create({
        title: String(body.title || '').trim(),
        description: String(body.description || '').trim(),
        business: body.business || null,
        address,
        startDate: String(body.startDate || '').trim(),
        endDate: String(body.endDate || '').trim(),
        active: body.active !== false,
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
      });
    },
    update: (id, body) => {
      const set = { ...body };
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? '').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      return Duyuru.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => Duyuru.findByIdAndDelete(id),
  },
  isilanlari: {
    list: () => IsIlani.find().lean(),
    add: (body) => {
      const address = {
        city: String(body.addressCity || body.address?.city || '').trim(),
        district: String(body.addressDistrict || body.address?.district || '').trim(),
        neighborhood: String(body.addressNeighborhood || body.address?.neighborhood || '').trim(),
      };
      return IsIlani.create({
        title: String(body.title || '').trim(),
        company: String(body.company || '').trim(),
        description: String(body.description || '').trim(),
        contactPhone: String(body.contactPhone || '').trim(),
        contactEmail: String(body.contactEmail || '').trim(),
        address,
        active: body.active !== false,
        imageUrl: (body.imageUrl || '').trim(),
        licenseExpiry: (body.licenseExpiry || '').trim(),
      });
    },
    update: (id, body) => {
      const set = { ...body };
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? '').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      return IsIlani.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => IsIlani.findByIdAndDelete(id),
  },
  yoresel_etkinlik: {
    list: () => YoreselEtkinlikIsletme.find().select('-password').sort({ name: 1 }).lean(),
    add: async (body) => {
      const address = {
        city: String(body.addressCity ?? body.address?.city ?? '').trim(),
        district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
        neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
      };
      if (!address.district) {
        return Promise.reject(new Error('İlçe zorunludur'));
      }
      const password = String(body.password || '').trim();
      if (password.length < 6) {
        return Promise.reject(new Error('Şifre en az 6 karakter olmalı'));
      }
      const tags = yoreselEtkinlikServiceTagsFromBody(body);
      const offeredTimeSlots = yoreselEtkinlikOfferedSlotsFromBody(body);
      if (offeredTimeSlots.length === 0) {
        return Promise.reject(new Error('En az bir rezervasyon dilimi seçin (Gündüz / Akşam / Tam gün)'));
      }
      const cityStr = String(body.addressCity ?? body.address?.city ?? '').trim();
      const districtStr = address.district;
      const commonFields = {
        phone: String(body.phone || '').trim(),
        description: String(body.description || '').trim(),
        serviceTags: tags,
        offeredTimeSlots,
        licenseExpiry: String(body.licenseExpiry || '').trim(),
        active: body.active !== false,
        premium: body.premium === true,
      };
      applyMediaFilesToSet(commonFields, body);

      if (body.multiOperator === true) {
        const { loginName, venueNames, neighborhoodForIndex } = parseYoreselMultiVenueBody(body);
        const loginGroupId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);
        const created = [];
        for (let i = 0; i < venueNames.length; i += 1) {
          const venueName = venueNames[i];
          const doc = await YoreselEtkinlikIsletme.create({
            name: venueName,
            loginName,
            loginGroupId,
            password: hashedPassword,
            address: {
              city: cityStr,
              district: districtStr,
              neighborhood: neighborhoodForIndex(i),
            },
            ...commonFields,
          });
          created.push(doc);
        }
        return created[0];
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      return YoreselEtkinlikIsletme.create({
        name: String(body.name || '').trim(),
        loginName: '',
        loginGroupId: '',
        password: hashedPassword,
        address,
        ...commonFields,
      });
    },
    update: async (id, body) => {
      const existing = await YoreselEtkinlikIsletme.findById(id).lean();
      if (!existing) return null;

      if (body.multiOperator === true && String(existing.loginGroupId || '').trim()) {
        const gid = String(existing.loginGroupId).trim();
        const districtStr = String(
          body.addressDistrict ?? body.address?.district ?? existing.address?.district ?? ''
        ).trim();
        if (!districtStr) return Promise.reject(new Error('İlçe zorunludur'));
        const cityStr = String(body.addressCity ?? body.address?.city ?? existing.address?.city ?? '').trim();
        const { loginName, venueNames, neighborhoodForIndex } = parseYoreselMultiVenueBody(body);
        const tags = yoreselEtkinlikServiceTagsFromBody(body);
        const offeredTimeSlots = yoreselEtkinlikOfferedSlotsFromBody(body);
        if (offeredTimeSlots.length === 0) {
          return Promise.reject(new Error('En az bir rezervasyon dilimi seçin'));
        }
        const commonFields = {
          loginName,
          phone: String(body.phone || '').trim(),
          description: String(body.description || '').trim(),
          serviceTags: tags,
          offeredTimeSlots,
          licenseExpiry: String(body.licenseExpiry || '').trim(),
          active: body.active !== false,
          premium: body.premium === true,
        };
        applyMediaFilesToSet(commonFields, body);
        const passwordPlain = String(body.password || '').trim();
        let hashedPassword = null;
        if (passwordPlain) {
          if (passwordPlain.length < 6) return Promise.reject(new Error('Şifre en az 6 karakter olmalı'));
          hashedPassword = await bcrypt.hash(passwordPlain, 10);
          commonFields.password = hashedPassword;
        }
        const siblings = await YoreselEtkinlikIsletme.find({ loginGroupId: gid }).sort({ createdAt: 1 }).lean();
        const fallbackPassword = siblings[0]?.password;
        const updatedDocs = [];
        for (let i = 0; i < venueNames.length; i += 1) {
          const venueSet = {
            ...commonFields,
            name: venueNames[i],
            address: {
              city: cityStr,
              district: districtStr,
              neighborhood: neighborhoodForIndex(i),
            },
          };
          if (!venueSet.password) delete venueSet.password;
          if (siblings[i]) {
            const doc = await YoreselEtkinlikIsletme.findByIdAndUpdate(
              siblings[i]._id,
              { $set: venueSet },
              { new: true }
            );
            updatedDocs.push(doc);
          } else {
            const pwd = hashedPassword || fallbackPassword;
            if (!pwd) return Promise.reject(new Error('Yeni mekan için şifre gerekli'));
            const doc = await YoreselEtkinlikIsletme.create({
              ...venueSet,
              loginGroupId: gid,
              password: pwd,
            });
            updatedDocs.push(doc);
          }
        }
        for (let j = venueNames.length; j < siblings.length; j += 1) {
          await YoreselEtkinlikIsletme.findByIdAndDelete(siblings[j]._id);
        }
        return updatedDocs.find((d) => String(d._id) === String(id)) || updatedDocs[0];
      }

      const set = { ...body };
      delete set.multiOperator;
      delete set.venueNamesText;
      delete set.venueNames;
      delete set.venueMahalleText;
      delete set.loginGroupId;
      if (body.addressCity !== undefined || body.addressDistrict !== undefined || body.addressNeighborhood !== undefined) {
        set.address = {
          city: String(body.addressCity ?? body.address?.city ?? '').trim(),
          district: String(body.addressDistrict ?? body.address?.district ?? '').trim(),
          neighborhood: String(body.addressNeighborhood ?? body.address?.neighborhood ?? '').trim(),
        };
        delete set.addressCity;
        delete set.addressDistrict;
        delete set.addressNeighborhood;
      }
      if (set.address && Object.prototype.hasOwnProperty.call(set.address, 'district') && !String(set.address.district || '').trim()) {
        return Promise.reject(new Error('İlçe zorunludur'));
      }
      if (body.serviceMuzisyen !== undefined || body.serviceAsci !== undefined || Array.isArray(body.serviceTags)) {
        set.serviceTags = yoreselEtkinlikServiceTagsFromBody(body);
        delete set.serviceMuzisyen;
        delete set.serviceAsci;
        delete set.serviceSusleme;
        delete set.serviceZurna;
        delete set.serviceParkSalon;
        delete set.serviceMekan;
        delete set.serviceKuafor;
        delete set.serviceAracKiralama;
      }
      if (
        body.offeredGunduz !== undefined
        || body.offeredAksam !== undefined
        || body.offeredTamGun !== undefined
        || Array.isArray(body.offeredTimeSlots)
      ) {
        const slots = yoreselEtkinlikOfferedSlotsFromBody(body);
        if (slots.length === 0) return Promise.reject(new Error('En az bir rezervasyon dilimi seçin'));
        set.offeredTimeSlots = slots;
        delete set.offeredGunduz;
        delete set.offeredAksam;
        delete set.offeredTamGun;
      }
      const passwordPlain = String(body.password || '').trim();
      if (body.password !== undefined) {
        if (!passwordPlain) delete set.password;
        else if (passwordPlain.length < 6) return Promise.reject(new Error('Şifre en az 6 karakter olmalı'));
      }
      if (passwordPlain && existing.loginGroupId) {
        const hashedPassword = await bcrypt.hash(passwordPlain, 10);
        await YoreselEtkinlikIsletme.updateMany(
          { loginGroupId: existing.loginGroupId },
          { $set: { password: hashedPassword } }
        );
        delete set.password;
      } else if (passwordPlain) {
        set.password = await bcrypt.hash(passwordPlain, 10);
      }
      if (body.premium !== undefined) {
        set.premium = body.premium === true;
        if (existing.loginGroupId) {
          await YoreselEtkinlikIsletme.updateMany(
            { loginGroupId: existing.loginGroupId },
            { $set: { premium: set.premium } }
          );
        }
      }
      applyMediaFilesToSet(set, body);
      return YoreselEtkinlikIsletme.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => YoreselEtkinlikIsletme.findByIdAndDelete(id),
  },
  uye_indirimi: {
    list: () => MemberDiscount.find().populate('business', 'businessName').sort({ createdAt: -1 }).lean(),
    add: async (body) => {
      const memberId = normalizeMemberId(body.memberId);
      if (!isValidMemberIdFormat(memberId)) {
        return Promise.reject(new Error('Geçersiz üye numarası (ör. 48X7K9M2)'));
      }
      const user = await User.findOne({ memberId }).select('_id').lean();
      if (!user) {
        return Promise.reject(new Error('Bu üye numarasına kayıtlı kullanıcı bulunamadı'));
      }
      const businessId = body.business || body.businessId;
      if (!businessId) {
        return Promise.reject(new Error('İşletme seçin'));
      }
      const business = await Business.findById(businessId).select('_id').lean();
      if (!business) {
        return Promise.reject(new Error('İşletme bulunamadı'));
      }
      let discountPercent = null;
      if (body.discountPercent != null && String(body.discountPercent).trim() !== '') {
        const n = Number(body.discountPercent);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          return Promise.reject(new Error('İndirim yüzdesi 0–100 arasında olmalı'));
        }
        discountPercent = n;
      }
      return MemberDiscount.create({
        memberId,
        business: businessId,
        title: String(body.title || '').trim(),
        description: String(body.description || '').trim(),
        discountPercent,
        validUntil: String(body.validUntil || '').trim(),
        active: body.active !== false,
        note: String(body.note || '').trim(),
      });
    },
    update: async (id, body) => {
      const existing = await MemberDiscount.findById(id);
      if (!existing) return null;
      const set = {};
      if (body.memberId != null) {
        const memberId = normalizeMemberId(body.memberId);
        if (!isValidMemberIdFormat(memberId)) {
          return Promise.reject(new Error('Geçersiz üye numarası (ör. 48X7K9M2)'));
        }
        const user = await User.findOne({ memberId }).select('_id').lean();
        if (!user) {
          return Promise.reject(new Error('Bu üye numarasına kayıtlı kullanıcı bulunamadı'));
        }
        set.memberId = memberId;
      }
      if (body.business != null || body.businessId != null) {
        const businessId = body.business || body.businessId;
        const business = await Business.findById(businessId).select('_id').lean();
        if (!business) {
          return Promise.reject(new Error('İşletme bulunamadı'));
        }
        set.business = businessId;
      }
      if (body.title != null) set.title = String(body.title).trim();
      if (body.description != null) set.description = String(body.description).trim();
      if (body.discountPercent != null) {
        const raw = String(body.discountPercent).trim();
        if (!raw) {
          set.discountPercent = null;
        } else {
          const n = Number(raw);
          if (Number.isNaN(n) || n < 0 || n > 100) {
            return Promise.reject(new Error('İndirim yüzdesi 0–100 arasında olmalı'));
          }
          set.discountPercent = n;
        }
      }
      if (body.validUntil != null) set.validUntil = String(body.validUntil).trim();
      if (body.active != null) set.active = body.active !== false;
      if (body.note != null) set.note = String(body.note).trim();
      return MemberDiscount.findByIdAndUpdate(id, { $set: set }, { new: true });
    },
    delete: (id) => MemberDiscount.findByIdAndDelete(id),
  },
};

function parseYoreselMultiVenueBody(body) {
  const loginName = String(body.loginName || '').trim();
  const raw = String(body.venueNamesText != null ? body.venueNamesText : body.venueNames || '');
  const venueNames = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!loginName) {
    throw new Error('Birden fazla mekan için giriş kullanıcı adı zorunludur');
  }
  if (venueNames.length < 2) {
    throw new Error('En az iki mekan adı girin (her satır bir mekan)');
  }
  if (venueNames.length > 25) {
    throw new Error('En fazla 25 mekan eklenebilir');
  }
  if (new Set(venueNames).size !== venueNames.length) {
    throw new Error('Mekan adları tekrar etmemeli (her satır benzersiz olmalı)');
  }
  const mahRaw = String(body.venueMahalleText != null ? body.venueMahalleText : '').split(/\r?\n/);
  const mahLines = mahRaw.map((s) => s.trim());
  const mahNonEmpty = mahLines.some((l) => l.length > 0);
  if (!mahNonEmpty) {
    throw new Error('Mahalle zorunludur (tek satırda ortak mahalle veya her mekan için bir satır)');
  }
  let neighborhoodForIndex;
  if (mahLines.length === 1 || (mahNonEmpty && mahLines.filter((l) => l).length === 1)) {
    const one = mahLines.find((l) => l) || '';
    neighborhoodForIndex = () => one;
  } else if (mahLines.length !== venueNames.length) {
    throw new Error('Mahalle: ya tek satır (tüm mekanlara ortak) ya da mekan adlarıyla aynı satır sayısı girin');
  } else {
    for (let mi = 0; mi < mahLines.length; mi += 1) {
      if (!String(mahLines[mi] || '').trim()) {
        throw new Error('Çoklu mahalle satırlarının tamamı dolu olmalı');
      }
    }
    neighborhoodForIndex = (i) => (mahLines[i] != null ? String(mahLines[i]).trim() : '');
  }
  return { loginName, venueNames, neighborhoodForIndex };
}

function yoreselEtkinlikServiceTagsFromBody(body) {
  if (Array.isArray(body.serviceTags)) {
    return [...new Set(body.serviceTags.map((t) => String(t).trim()).filter((t) => YORESEL_SERVICE_TAGS.includes(t)))];
  }
  const out = [];
  if (body.serviceMuzisyen) out.push('muzisyen');
  if (body.serviceAsci) out.push('asci');
  if (body.serviceSusleme) out.push('susleme');
  if (body.serviceZurna) out.push('zurna');
  if (body.serviceParkSalon) out.push('park_salon');
  if (body.serviceMekan) out.push('mekan');
  if (body.serviceKuafor) out.push('kuafor');
  if (body.serviceAracKiralama) out.push('arac_kiralama');
  return [...new Set(out)];
}

function yoreselEtkinlikOfferedSlotsFromBody(body) {
  if (Array.isArray(body.offeredTimeSlots)) {
    return [...new Set(body.offeredTimeSlots.map((t) => String(t).trim()).filter((t) => YORESEL_ISLETME_TIME_SLOTS.includes(t)))];
  }
  const out = [];
  if (body.offeredGunduz !== false) out.push('gunduz');
  if (body.offeredAksam !== false) out.push('aksam');
  if (body.offeredTamGun !== false) out.push('tam_gun');
  return [...new Set(out)];
}

const ADMIN_TYPES = [
  'isletme',
  'esnaf',
  'kampanyalar',
  'duyurular',
  'cekici',
  'lastikci',
  'taksi',
  'isilanlari',
  'yoresel_etkinlik',
  'uye_indirimi',
];

const VALID_ACTIVITY_FIELDS = ['restorant', 'cafe_bar', 'tekne_turu', 'plaj_beach'];

function getExpiringSoonFilter(days = 30) {
  const todayStr = getTodayLocalStr();
  const today = new Date(todayStr + 'T12:00:00');
  const end = new Date(today);
  end.setDate(end.getDate() + Number(days));
  const endStr = end.toISOString().slice(0, 10);
  return { $gte: todayStr, $lte: endStr };
}

const ADMIN_TYPE_MODELS = {
  isletme: Business,
  esnaf: Esnaf,
  kampanyalar: Kampanya,
  duyurular: Duyuru,
  cekici: Cekici,
  lastikci: Lastikci,
  taksi: Taksi,
  isilanlari: IsIlani,
  yoresel_etkinlik: YoreselEtkinlikIsletme,
  uye_indirimi: MemberDiscount,
};

/** Kullanıcı ve işletme listeleriyle aynı: ?city=&district=&neighborhood= */
function addressQueryStringsFromReq(req) {
  const city = req.query.city != null ? String(req.query.city).trim() : '';
  const district = req.query.district != null ? String(req.query.district).trim() : '';
  const neighborhood = req.query.neighborhood != null ? String(req.query.neighborhood).trim() : '';
  return { city, district, neighborhood };
}

async function runAdminListFind(type, query) {
  const Model = ADMIN_TYPE_MODELS[type];
  if (type === 'kampanyalar') {
    return Model.find(query).populate('business', 'businessName phone').sort({ createdAt: -1 }).lean();
  }
  if (type === 'duyurular') {
    return Model.find(query).populate('business', 'businessName').sort({ createdAt: -1 }).lean();
  }
  if (type === 'isletme') {
    return Model.find(query).select('-password').sort({ businessName: 1 }).lean();
  }
  if (type === 'yoresel_etkinlik') {
    return Model.find(query).select('-password').sort({ name: 1 }).lean();
  }
  if (type === 'uye_indirimi') {
    return Model.find(query).populate('business', 'businessName').sort({ createdAt: -1 }).lean();
  }
  return Model.find(query).lean();
}

// Duyurular ve Kampanyalar için ayrı liste endpoint'leri (karışıklığı önlemek için)
app.get('/api/admin/list/duyurular', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Duyuru);
    const { city, district, neighborhood } = addressQueryStringsFromReq(req);
    const query = {};
    mergeAddressStringFilters(query, city, district, neighborhood);
    const list = await Duyuru.find(query)
      .populate('business', 'businessName')
      .populate('yoreselIsletme', 'loginName name phone address')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ list });
  } catch (e) {
    console.error('Admin duyurular list error:', e);
    res.status(500).json({ error: 'Liste alınamadı', message: e.message });
  }
});

app.get('/api/admin/list/kampanyalar', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    await deleteExpiredLicenses(Kampanya);
    const { city, district, neighborhood } = addressQueryStringsFromReq(req);
    const query = { listType: 'kampanya' };
    mergeAddressStringFilters(query, city, district, neighborhood);
    const list = await Kampanya.find(query).populate('business', 'businessName phone').sort({ createdAt: -1 }).lean();
    res.json({ list });
  } catch (e) {
    console.error('Admin kampanyalar list error:', e);
    res.status(500).json({ error: 'Liste alınamadı', message: e.message });
  }
});

app.get('/api/admin/:type', async (req, res) => {
  try {
    const type = req.params.type;
    if (!ADMIN_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Geçersiz liste türü' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const { city, district, neighborhood } = addressQueryStringsFromReq(req);
    const expiringDays = req.query.expiringSoon ? parseInt(req.query.expiringSoon, 10) : 0;

    const typesWithLicenseCleanup = [
      'isletme',
      'kampanyalar',
      'duyurular',
      'isilanlari',
      'cekici',
      'lastikci',
      'taksi',
      'yoresel_etkinlik',
    ];
    if (typesWithLicenseCleanup.includes(type)) {
      await deleteExpiredLicenses(ADMIN_TYPE_MODELS[type]);
    }

    let list;
    if (expiringDays > 0 && expiringDays <= 365) {
      const range = getExpiringSoonFilter(expiringDays);
      const query = { licenseExpiry: { $gte: range.$gte, $lte: range.$lte } };
      if (type === 'kampanyalar') query.listType = 'kampanya';
      mergeAddressStringFilters(query, city, district, neighborhood);
      list = await runAdminListFind(type, query);
    } else {
      const query = {};
      if (type === 'isletme') {
        const forPicker = req.query.forPicker === '1' || req.query.forPicker === 'true';
        if (!forPicker) {
          query.approved = true;
        }
        if (req.query.activityField) {
          const activityField = String(req.query.activityField).trim();
          if (VALID_ACTIVITY_FIELDS.includes(activityField)) {
            query.activityField = activityField;
          }
        }
      } else if (type === 'kampanyalar') {
        query.listType = 'kampanya';
      } else if (type === 'esnaf' && req.query.category) {
        const category = String(req.query.category).trim();
        if (category) {
          const catVar = turkishAddressVariants(category);
          if (catVar) query.category = { $in: catVar };
        }
      } else if (type === 'yoresel_etkinlik' && req.query.serviceTag) {
        const serviceTag = String(req.query.serviceTag).trim();
        if (serviceTag && YORESEL_SERVICE_TAGS.includes(serviceTag)) {
          query.serviceTags = serviceTag;
        }
      } else if (type === 'yoresel_etkinlik' && req.query.loginGroupId) {
        const loginGroupId = String(req.query.loginGroupId).trim();
        if (loginGroupId) query.loginGroupId = loginGroupId;
      }
      mergeAddressStringFilters(query, city, district, neighborhood);
      list = await runAdminListFind(type, query);
    }
    res.json({ list });
  } catch (e) {
    console.error('Admin list error:', e);
    res.status(500).json({ error: 'Liste alınamadı', message: e.message });
  }
});

app.post('/api/admin/:type', async (req, res) => {
  try {
    const type = req.params.type;
    if (!ADMIN_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Geçersiz liste türü' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    if (ADMIN_TYPES_WITH_LICENSE_EXPIRY.includes(type) && req.body && req.body.licenseExpiry != null) {
      const licErr = validateLicenseExpiryNotBeforeToday(req.body.licenseExpiry);
      if (licErr) return res.status(400).json({ error: licErr, message: licErr });
    }
    const doc = await adminListHandlers[type].add(sanitizePhoneFieldsInBody(req.body));
    const out = doc.toObject ? doc.toObject() : doc;
    if (out.password) delete out.password;
    res.status(201).json({ item: out });
  } catch (e) {
    console.error('Admin add error:', e);
    res.status(500).json({ error: 'Eklenemedi', message: e.message });
  }
});

app.put('/api/admin/:type/:id', async (req, res) => {
  try {
    const type = req.params.type;
    const id = req.params.id;
    if (!ADMIN_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Geçersiz liste türü' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    if (
      ADMIN_TYPES_WITH_LICENSE_EXPIRY.includes(type)
      && req.body
      && Object.prototype.hasOwnProperty.call(req.body, 'licenseExpiry')
    ) {
      const lic = req.body.licenseExpiry != null ? String(req.body.licenseExpiry).trim() : '';
      if (lic) {
        const licErr = validateLicenseExpiryNotBeforeToday(lic);
        if (licErr) return res.status(400).json({ error: licErr, message: licErr });
      }
    }
    const doc = await adminListHandlers[type].update(id, sanitizePhoneFieldsInBody(req.body));
    if (!doc) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    const out = doc.toObject ? doc.toObject() : doc;
    if (out && out.password) delete out.password;
    res.json({ item: out });
  } catch (e) {
    console.error('Admin update error:', e);
    res.status(500).json({ error: 'Güncellenemedi', message: e.message });
  }
});

app.delete('/api/admin/:type/:id', async (req, res) => {
  try {
    const type = req.params.type;
    const id = req.params.id;
    if (!ADMIN_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Geçersiz liste türü' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
    }
    const doc = await adminListHandlers[type].delete(id);
    if (!doc) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    res.json({ message: 'Silindi' });
  } catch (e) {
    console.error('Admin delete error:', e);
    res.status(500).json({ error: 'Silinemedi', message: e.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📱 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📶 Aynı Wi-Fi'daki telefon için: http://<bilgisayar-ip>:${PORT}/api`);
  // MongoDB bağlantı durumu (connectDB asenkron, birkaç saniye sonra güncellenir)
  const checkDb = () => {
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB connected successfully');
    } else {
      console.log('⏳ MongoDB bağlantısı bekleniyor veya bağlı değil (kayıt/giriş çalışmaz).');
      console.log('   → Atlas kullanıyorsanız: Network Access\'te IP ekleyin (0.0.0.0/0). Şifreyi .env\'de URL encode edin.');
      setTimeout(() => {
        if (mongoose.connection.readyState === 1) console.log('✅ MongoDB bağlandı.');
        else console.log('   Hâlâ bağlı değil. .env MONGODB_URI ve Atlas ayarlarını kontrol edin.');
      }, 8000);
    }
  };
  setTimeout(checkDb, 6000);
});


