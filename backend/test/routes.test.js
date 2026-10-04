process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Business = require('../models/Business');
const Reservation = require('../models/Reservation');
const YoreselEtkinlikTalep = require('../models/YoreselEtkinlikTalep');
const AppSettings = require('../models/AppSettings');
const Payment = require('../models/Payment');

const app = require('../server');

const USER_ID = '64b1f0c2a1b2c3d4e5f60789';
const BUSINESS_ID = '64b1f0c2a1b2c3d4e5f60788';

const ORIGINALS = {
  userFindById: User.findById,
  businessFindById: Business.findById,
  businessFind: Business.find,
  reservationCount: Reservation.countDocuments,
  yoreselFind: YoreselEtkinlikTalep.find,
  yoreselCount: YoreselEtkinlikTalep.countDocuments,
  appSettingsFindOne: AppSettings.findOne,
  paymentFindOne: Payment.findOne,
};

const validRegister = {
  username: 'ali',
  password: '123456',
  name: 'Ali',
  surname: 'Yılmaz',
  phone: '05551234567',
  dateOfBirth: '23/09/1990',
  specialDay: '01/01/2020',
  address: { city: 'Muğla', district: 'Menteşe', neighborhood: 'Merkez' },
};

function setReadyState(value) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => value,
  });
}

function mockAppSettingsFee(fee) {
  AppSettings.findOne = () => ({
    lean: async () => ({ yoreselReservationFee: fee }),
  });
}

function mockNoPaidYoreselCredit() {
  Payment.findOne = () => ({
    sort: () => ({
      lean: async () => null,
    }),
  });
}

function mockMemberUser() {
  User.findById = () => ({
    select: () => ({
      lean: async () => ({ _id: USER_ID }),
    }),
  });
}

function mockOpenRestaurant() {
  const business = {
    _id: BUSINESS_ID,
    activityField: 'restorant',
    openingHours: {
      weekdays: { open: '09:00', close: '22:00' },
      weekend: { open: '09:00', close: '22:00' },
    },
    reservationClosedDates: [],
  };
  Business.findById = async () => business;
  Business.find = () => ({
    select: () => ({
      lean: async () => [{ _id: BUSINESS_ID }],
    }),
  });
}

async function post(path, body) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

before(() => {
  setReadyState(1);
  YoreselEtkinlikTalep.find = async () => [];
  mockAppSettingsFee(0);
});

after(() => {
  User.findById = ORIGINALS.userFindById;
  Business.findById = ORIGINALS.businessFindById;
  Business.find = ORIGINALS.businessFind;
  Reservation.countDocuments = ORIGINALS.reservationCount;
  YoreselEtkinlikTalep.find = ORIGINALS.yoreselFind;
  YoreselEtkinlikTalep.countDocuments = ORIGINALS.yoreselCount;
  AppSettings.findOne = ORIGINALS.appSettingsFindOne;
  Payment.findOne = ORIGINALS.paymentFindOne;
});

test('POST /api/register returns 400 without KVKK consent', async () => {
  const res = await post('/api/register', validRegister);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /KVKK/);
});

test('POST /api/register returns 400 for invalid birth date', async () => {
  const res = await post('/api/register', {
    ...validRegister,
    dateOfBirth: '31/02/2020',
    kvkkConsent: { phoneShare: true, location: true },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Doğum tarihi/);
});

test('POST /api/reservations returns 401 without member', async () => {
  const res = await post('/api/reservations', {
    businessId: BUSINESS_ID,
    date: '2026-09-23',
    slot: '10:00',
  });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /üye/i);
});

test('POST /api/reservations returns 429 at 5 active pending+approved', async () => {
  mockMemberUser();
  mockOpenRestaurant();
  Reservation.countDocuments = async () => 5;
  const res = await post('/api/reservations', {
    businessId: BUSINESS_ID,
    userId: USER_ID,
    date: '2026-09-23',
    slot: '10:00',
  });
  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'ACTIVE_RESERVATION_LIMIT');
});

test('POST /api/reservations returns 429 at 2 same-day same activity (rejected excluded in query)', async () => {
  mockMemberUser();
  mockOpenRestaurant();
  const seen = [];
  Reservation.countDocuments = async (q) => {
    seen.push(q);
    if (q.status && q.status.$in) return 0;
    assert.deepEqual(q.status, { $ne: 'rejected' });
    return 2;
  };
  const res = await post('/api/reservations', {
    businessId: BUSINESS_ID,
    userId: USER_ID,
    date: '2026-09-23',
    slot: '10:00',
  });
  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'ACTIVITY_DAILY_LIMIT');
  assert.ok(seen.some((q) => q.status && q.status.$ne === 'rejected'));
});

test('POST /api/yoresel-etkinlik/talep returns 401 without member', async () => {
  YoreselEtkinlikTalep.countDocuments = async () => 0;
  const res = await post('/api/yoresel-etkinlik/talep', {
    date: '2026-09-23',
    eventType: 'dugun',
    services: { muzisyen: true },
  });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /üye/i);
});

test('POST /api/yoresel-etkinlik/talep returns 429 at 2 today including cancelled', async () => {
  mockMemberUser();
  YoreselEtkinlikTalep.countDocuments = async (q) => {
    assert.equal(q.status, undefined);
    return 2;
  };
  const res = await post('/api/yoresel-etkinlik/talep', {
    date: '2026-09-23',
    eventType: 'dugun',
    services: { muzisyen: true },
    userId: USER_ID,
  });
  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'DAILY_LIMIT');
});

test('POST /api/yoresel-etkinlik/talep returns 429 at 3 in 30 days', async () => {
  mockMemberUser();
  YoreselEtkinlikTalep.countDocuments = async (q) => {
    const start = q.createdAt.$gte;
    const end = q.createdAt.$lt;
    const hours = (end - start) / 36e5;
    if (hours <= 25) return 0;
    return 3;
  };
  const res = await post('/api/yoresel-etkinlik/talep', {
    date: '2026-09-23',
    eventType: 'dugun',
    services: { muzisyen: true },
    userId: USER_ID,
  });
  assert.equal(res.status, 429);
  assert.equal(res.body.code, 'PERIOD_LIMIT');
});

test('POST /api/yoresel-etkinlik/talep returns 402 without paid reservation fee', async () => {
  mockMemberUser();
  mockAppSettingsFee(150);
  mockNoPaidYoreselCredit();
  YoreselEtkinlikTalep.countDocuments = async () => 0;
  const res = await post('/api/yoresel-etkinlik/talep', {
    date: '2026-09-23',
    eventType: 'dugun',
    services: { muzisyen: true },
    userId: USER_ID,
  });
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'PAYMENT_REQUIRED');
  mockAppSettingsFee(0);
});

test('POST /api/payments/yoresel/init returns 503 when iyzico is not configured', async () => {
  mockMemberUser();
  mockAppSettingsFee(150);
  mockNoPaidYoreselCredit();
  delete process.env.IYZICO_API_KEY;
  delete process.env.IYZICO_SECRET_KEY;
  const res = await post('/api/payments/yoresel/init', { userId: USER_ID });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'PAYMENT_NOT_CONFIGURED');
  mockAppSettingsFee(0);
});
