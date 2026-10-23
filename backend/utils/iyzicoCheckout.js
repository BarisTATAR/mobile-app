function isIyzicoConfigured() {
  return Boolean(String(process.env.IYZICO_API_KEY || '').trim() && String(process.env.IYZICO_SECRET_KEY || '').trim());
}

function iyzicoClient() {
  if (!isIyzicoConfigured()) return null;
  // Lazy load so tests run without the package being exercised.
  const Iyzipay = require('iyzipay');
  return new Iyzipay({
    apiKey: String(process.env.IYZICO_API_KEY).trim(),
    secretKey: String(process.env.IYZICO_SECRET_KEY).trim(),
    uri: String(process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com').trim(),
  });
}

function publicApiBase(req) {
  const env = String(process.env.PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  if (env) return env;
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = String(protoHeader || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = req.get('host');
  return `${proto}://${host}`;
}

function clientIpFromRequest(req) {
  if (!req) return '85.34.37.1';
  const xf = req.headers['x-forwarded-for'];
  if (xf) {
    const ip = String(xf).split(',')[0].trim();
    if (ip) return ip.replace(/^::ffff:/, '');
  }
  const raw = req.ip || req.socket?.remoteAddress || '';
  const ip = String(raw).replace(/^::ffff:/, '').trim();
  if (ip && ip !== '::1' && ip !== '127.0.0.1') return ip;
  return '85.34.37.1';
}

function isIyzicoSandbox() {
  const uri = String(process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com').toLowerCase();
  return uri.includes('sandbox');
}

function buyerFromUser(user, paymentId, clientIp) {
  const name = String(user.name || 'Üye').trim() || 'Üye';
  const surname = String(user.surname || 'Kullanıcı').trim() || 'Kullanıcı';
  const phone = String(user.phone || '').replace(/\D/g, '') || '5550000000';
  const city = String(user.address?.city || 'Muğla').trim() || 'Muğla';
  const district = String(user.address?.district || 'Menteşe').trim() || 'Menteşe';
  const neighborhood = String(user.address?.neighborhood || '').trim();
  const address = [neighborhood, district, city].filter(Boolean).join(', ') || 'Muğla';
  const username = String(user.username || 'uye').replace(/[^a-z0-9._-]/gi, '') || 'uye';
  return {
    id: String(user._id || paymentId),
    name,
    surname,
    gsmNumber: phone.startsWith('90') ? `+${phone}` : `+90${phone.replace(/^0/, '')}`,
    email: `${username}@uye.48app.com`,
    identityNumber: '11111111111',
    registrationAddress: address,
    city,
    country: 'Turkey',
    ip: clientIp || '85.34.37.1',
  };
}

function initializeCheckoutForm(reqPayload) {
  const client = iyzicoClient();
  if (!client) {
    const err = new Error('iyzico yapılandırılmadı');
    err.status = 503;
    throw err;
  }
  return new Promise((resolve, reject) => {
    client.checkoutFormInitialize.create(reqPayload, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function retrieveCheckoutForm(token) {
  const client = iyzicoClient();
  if (!client) {
    const err = new Error('iyzico yapılandırılmadı');
    err.status = 503;
    throw err;
  }
  return new Promise((resolve, reject) => {
    client.checkoutForm.retrieve({ locale: 'tr', token }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function buildCheckoutRequest({ payment, user, fee, callbackUrl, clientIp }) {
  const conversationId = String(payment._id);
  const price = Number(fee).toFixed(2);
  const buyer = buyerFromUser(user, conversationId, clientIp);
  const address = {
    contactName: `${buyer.name} ${buyer.surname}`.trim(),
    city: buyer.city,
    country: 'Turkey',
    address: buyer.registrationAddress,
  };
  return {
    locale: 'tr',
    conversationId,
    price,
    paidPrice: price,
    currency: 'TRY',
    basketId: conversationId,
    paymentGroup: 'PRODUCT',
    callbackUrl,
    enabledInstallments: [1],
    buyer,
    shippingAddress: address,
    billingAddress: address,
    basketItems: [
      {
        id: 'yoresel-rezervasyon',
        name: 'Yöresel etkinlik rezervasyon bedeli',
        category1: 'Rezervasyon',
        itemType: 'VIRTUAL',
        price,
      },
    ],
  };
}

module.exports = {
  isIyzicoConfigured,
  isIyzicoSandbox,
  publicApiBase,
  clientIpFromRequest,
  initializeCheckoutForm,
  retrieveCheckoutForm,
  buildCheckoutRequest,
};
