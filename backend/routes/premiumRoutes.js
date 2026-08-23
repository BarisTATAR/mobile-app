function registerPremiumRoutes(app, deps) {
  const {
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
  } = deps;

  app.post('/api/login-premium-listing', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const listingType = String(req.body?.listingType || req.body?.ownerType || '').trim();
      const loginKey = String(req.body?.loginKey || req.body?.name || req.body?.phone || '').trim();
      const password = String(req.body?.password || '');
      if (!PREMIUM_OWNER_TYPES.includes(listingType) || listingType === 'isletme' || listingType === 'yoresel_etkinlik') {
        return res.status(400).json({ error: 'Geçersiz liste türü' });
      }
      if (!loginKey || !password) {
        return res.status(400).json({ error: 'Giriş bilgisi ve şifre gerekli' });
      }
      const cfg = PREMIUM_OWNER[listingType];
      const doc = await cfg.findForLogin(loginKey);
      if (!doc || !doc.password) {
        return res.status(401).json({ error: 'Geçersiz giriş veya premium değil' });
      }
      const match = await bcrypt.compare(password, doc.password);
      if (!match) return res.status(401).json({ error: 'Geçersiz giriş veya premium değil' });
      const meta = ownerMetaFromDoc(listingType, doc);
      res.json({
        success: true,
        ownerType: listingType,
        ownerId: String(doc._id),
        displayName: meta.displayName,
        loginKey: phoneDigitsOnly(doc.phone) || meta.displayName,
        premium: true,
        registeredDistrict: String(meta.address?.district || '').trim(),
      });
    } catch (e) {
      console.error('Premium listing login error:', e);
      res.status(500).json({ error: 'Giriş sırasında hata', message: e.message });
    }
  });

  async function premiumGuard(req, res) {
    const ownerType = String(req.params.ownerType || '').trim();
    const ownerId = String(req.params.ownerId || '').trim();
    const loginKey = String(req.query.loginKey || req.body?.loginKey || '').trim();
    if (!PREMIUM_OWNER_TYPES.includes(ownerType) || !mongoose.Types.ObjectId.isValid(ownerId)) {
      res.status(400).json({ error: 'Geçersiz işletme türü veya id' });
      return null;
    }
    const ownerDoc = await loadPremiumOwnerForRequest(ownerType, ownerId, loginKey);
    if (!ownerDoc) {
      res.status(403).json({ error: 'Yetkisiz veya premium değil' });
      return null;
    }
    return { ownerType, ownerId, ownerDoc, loginKey };
  }

  app.get('/api/premium/:ownerType/:ownerId/kampanyalar', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok', list: [] });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const scope = await premiumOwnerContentQuery(ctx.ownerType, ctx.ownerDoc);
      const list = await Kampanya.find({ listType: 'kampanya', ...scope }).sort({ createdAt: -1 }).lean();
      res.json({ list });
    } catch (e) {
      console.error('Premium kampanyalar list error:', e);
      res.status(500).json({ error: 'Liste alınamadı', list: [] });
    }
  });

  app.post('/api/premium/:ownerType/:ownerId/kampanyalar', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Başlık gerekli' });
      const licenseExpiry = String(req.body?.licenseExpiry || '').trim();
      if (licenseExpiry) {
        const licErr = validateLicenseExpiryNotBeforeToday(licenseExpiry);
        if (licErr) return res.status(400).json({ error: licErr });
      }
      const meta = ownerMetaFromDoc(ctx.ownerType, ctx.ownerDoc);
      const ownerIds = premiumOwnerIdsForCreate(ctx.ownerType, ctx.ownerDoc);
      const doc = await Kampanya.create({
        listType: 'kampanya',
        title,
        description: String(req.body?.description || '').trim(),
        companyName: String(req.body?.companyName || meta.displayName || '').trim(),
        contactPhone: String(req.body?.contactPhone || meta.phone || '').trim(),
        business: ctx.ownerType === 'isletme' ? ctx.ownerDoc._id : null,
        ...ownerIds,
        address: premiumAddressFromBody(req.body, meta.address),
        startDate: String(req.body?.startDate || '').trim(),
        endDate: String(req.body?.endDate || '').trim(),
        discountText: String(req.body?.discountText || '').trim(),
        active: req.body?.active !== false,
        imageUrl: String(req.body?.imageUrl || '').trim(),
        licenseExpiry,
      });
      res.status(201).json({ message: 'Kampanya eklendi', item: doc.toObject() });
    } catch (e) {
      console.error('Premium kampanya create error:', e);
      res.status(500).json({ error: 'Eklenemedi', message: e.message });
    }
  });

  app.patch('/api/premium/:ownerType/:ownerId/kampanyalar/:itemId', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const { itemId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Geçersiz id' });
      const scope = await premiumOwnerContentQuery(ctx.ownerType, ctx.ownerDoc);
      const existing = await Kampanya.findOne({ _id: itemId, listType: 'kampanya', ...scope });
      if (!existing) return res.status(404).json({ error: 'Kampanya bulunamadı' });
      const set = {};
      if (req.body?.title !== undefined) {
        const t = String(req.body.title || '').trim();
        if (!t) return res.status(400).json({ error: 'Başlık boş olamaz' });
        set.title = t;
      }
      if (req.body?.description !== undefined) set.description = String(req.body.description || '').trim();
      if (req.body?.companyName !== undefined) set.companyName = String(req.body.companyName || '').trim();
      if (req.body?.contactPhone !== undefined) set.contactPhone = String(req.body.contactPhone || '').trim();
      if (req.body?.discountText !== undefined) set.discountText = String(req.body.discountText || '').trim();
      if (req.body?.startDate !== undefined) set.startDate = String(req.body.startDate || '').trim();
      if (req.body?.endDate !== undefined) set.endDate = String(req.body.endDate || '').trim();
      if (req.body?.active !== undefined) set.active = req.body.active !== false;
      if (req.body?.imageUrl !== undefined) set.imageUrl = String(req.body.imageUrl || '').trim();
      if (req.body?.licenseExpiry !== undefined) {
        const licenseExpiry = String(req.body.licenseExpiry || '').trim();
        if (licenseExpiry) {
          const licErr = validateLicenseExpiryNotBeforeToday(licenseExpiry);
          if (licErr) return res.status(400).json({ error: licErr });
        }
        set.licenseExpiry = licenseExpiry;
      }
      if (
        req.body?.addressCity !== undefined
        || req.body?.addressDistrict !== undefined
        || req.body?.addressNeighborhood !== undefined
      ) {
        set.address = premiumAddressFromBody(req.body, existing.address);
      }
      const updated = await Kampanya.findByIdAndUpdate(itemId, { $set: set }, { new: true }).lean();
      res.json({ message: 'Kampanya güncellendi', item: updated });
    } catch (e) {
      console.error('Premium kampanya update error:', e);
      res.status(500).json({ error: 'Güncellenemedi', message: e.message });
    }
  });

  app.delete('/api/premium/:ownerType/:ownerId/kampanyalar/:itemId', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const { itemId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Geçersiz id' });
      const scope = await premiumOwnerContentQuery(ctx.ownerType, ctx.ownerDoc);
      const existing = await Kampanya.findOne({ _id: itemId, listType: 'kampanya', ...scope });
      if (!existing) return res.status(404).json({ error: 'Kampanya bulunamadı' });
      await Kampanya.findByIdAndDelete(itemId);
      res.json({ message: 'Kampanya silindi' });
    } catch (e) {
      console.error('Premium kampanya delete error:', e);
      res.status(500).json({ error: 'Silinemedi', message: e.message });
    }
  });

  app.get('/api/premium/:ownerType/:ownerId/isilanlari', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok', list: [] });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const scope = await premiumOwnerContentQuery(ctx.ownerType, ctx.ownerDoc);
      const list = await IsIlani.find(scope).sort({ createdAt: -1 }).lean();
      res.json({ list });
    } catch (e) {
      console.error('Premium isilanlari list error:', e);
      res.status(500).json({ error: 'Liste alınamadı', list: [] });
    }
  });

  app.post('/api/premium/:ownerType/:ownerId/isilanlari', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Başlık gerekli' });
      const licenseExpiry = String(req.body?.licenseExpiry || '').trim();
      if (licenseExpiry) {
        const licErr = validateLicenseExpiryNotBeforeToday(licenseExpiry);
        if (licErr) return res.status(400).json({ error: licErr });
      }
      const meta = ownerMetaFromDoc(ctx.ownerType, ctx.ownerDoc);
      const ownerIds = premiumOwnerIdsForCreate(ctx.ownerType, ctx.ownerDoc);
      const doc = await IsIlani.create({
        title,
        company: String(req.body?.company || meta.displayName || '').trim(),
        description: String(req.body?.description || '').trim(),
        contactPhone: String(req.body?.contactPhone || meta.phone || '').trim(),
        contactEmail: String(req.body?.contactEmail || '').trim(),
        ...ownerIds,
        address: premiumAddressFromBody(req.body, meta.address),
        active: req.body?.active !== false,
        imageUrl: String(req.body?.imageUrl || '').trim(),
        licenseExpiry,
      });
      res.status(201).json({ message: 'İş ilanı eklendi', item: doc.toObject() });
    } catch (e) {
      console.error('Premium is ilani create error:', e);
      res.status(500).json({ error: 'Eklenemedi', message: e.message });
    }
  });

  app.patch('/api/premium/:ownerType/:ownerId/isilanlari/:itemId', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const { itemId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Geçersiz id' });
      const scope = await premiumOwnerContentQuery(ctx.ownerType, ctx.ownerDoc);
      const existing = await IsIlani.findOne({ _id: itemId, ...scope });
      if (!existing) return res.status(404).json({ error: 'İş ilanı bulunamadı' });
      const set = {};
      if (req.body?.title !== undefined) {
        const t = String(req.body.title || '').trim();
        if (!t) return res.status(400).json({ error: 'Başlık boş olamaz' });
        set.title = t;
      }
      if (req.body?.company !== undefined) set.company = String(req.body.company || '').trim();
      if (req.body?.description !== undefined) set.description = String(req.body.description || '').trim();
      if (req.body?.contactPhone !== undefined) set.contactPhone = String(req.body.contactPhone || '').trim();
      if (req.body?.contactEmail !== undefined) set.contactEmail = String(req.body.contactEmail || '').trim();
      if (req.body?.active !== undefined) set.active = req.body.active !== false;
      if (req.body?.imageUrl !== undefined) set.imageUrl = String(req.body.imageUrl || '').trim();
      if (req.body?.licenseExpiry !== undefined) {
        const licenseExpiry = String(req.body.licenseExpiry || '').trim();
        if (licenseExpiry) {
          const licErr = validateLicenseExpiryNotBeforeToday(licenseExpiry);
          if (licErr) return res.status(400).json({ error: licErr });
        }
        set.licenseExpiry = licenseExpiry;
      }
      if (
        req.body?.addressCity !== undefined
        || req.body?.addressDistrict !== undefined
        || req.body?.addressNeighborhood !== undefined
      ) {
        set.address = premiumAddressFromBody(req.body, existing.address);
      }
      const updated = await IsIlani.findByIdAndUpdate(itemId, { $set: set }, { new: true }).lean();
      res.json({ message: 'İş ilanı güncellendi', item: updated });
    } catch (e) {
      console.error('Premium is ilani update error:', e);
      res.status(500).json({ error: 'Güncellenemedi', message: e.message });
    }
  });

  app.delete('/api/premium/:ownerType/:ownerId/isilanlari/:itemId', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      const { itemId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Geçersiz id' });
      const scope = await premiumOwnerContentQuery(ctx.ownerType, ctx.ownerDoc);
      const existing = await IsIlani.findOne({ _id: itemId, ...scope });
      if (!existing) return res.status(404).json({ error: 'İş ilanı bulunamadı' });
      await IsIlani.findByIdAndDelete(itemId);
      res.json({ message: 'İş ilanı silindi' });
    } catch (e) {
      console.error('Premium is ilani delete error:', e);
      res.status(500).json({ error: 'Silinemedi', message: e.message });
    }
  });

  const MENU_LISTING_TYPES = ['isletme', 'esnaf', 'cekici', 'lastikci', 'taksi', 'yoresel_etkinlik'];

  app.get('/api/premium/:ownerType/:ownerId/menu', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      if (!MENU_LISTING_TYPES.includes(ctx.ownerType)) {
        return res.status(400).json({ error: 'Bu tür için menü desteklenmiyor' });
      }
      res.json({
        menuPdfUrl: String(ctx.ownerDoc.menuPdfUrl || '').trim(),
        menuImageUrl: String(ctx.ownerDoc.menuImageUrl || '').trim(),
        mediaFiles: require('../utils/listingMedia').mediaFilesFromDoc(ctx.ownerDoc),
      });
    } catch (e) {
      console.error('Premium menu get error:', e);
      res.status(500).json({ error: 'Menü alınamadı', message: e.message });
    }
  });

  app.patch('/api/premium/:ownerType/:ownerId/menu', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Veritabanı bağlantısı yok' });
      }
      const ctx = await premiumGuard(req, res);
      if (!ctx) return;
      if (!MENU_LISTING_TYPES.includes(ctx.ownerType)) {
        return res.status(400).json({ error: 'Bu tür için menü desteklenmiyor' });
      }
      const { applyMediaFilesToSet, enrichListingMedia } = require('../utils/listingMedia');
      const cfg = PREMIUM_OWNER[ctx.ownerType];
      const set = {};
      applyMediaFilesToSet(set, req.body);
      const doc = await cfg.Model.findByIdAndUpdate(ctx.ownerId, { $set: set }, { new: true })
        .select('menuPdfUrl menuImageUrl mediaFiles imageUrl')
        .lean();
      if (!doc) return res.status(404).json({ error: 'Kayıt bulunamadı' });
      const enriched = enrichListingMedia(doc);
      res.json({
        message: 'Menü güncellendi',
        menuPdfUrl: enriched.menuPdfUrl || '',
        menuImageUrl: enriched.menuImageUrl || '',
        mediaFiles: enriched.mediaFiles || [],
      });
    } catch (e) {
      console.error('Premium menu update error:', e);
      res.status(500).json({ error: 'Menü güncellenemedi', message: e.message });
    }
  });
}

module.exports = registerPremiumRoutes;
