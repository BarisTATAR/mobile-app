const mongoose = require('mongoose');

const listingMediaFileSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'pdf'], required: true },
    url: { type: String, trim: true, required: true },
    name: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

function normalizeMediaFileEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const type = entry.type === 'pdf' ? 'pdf' : 'image';
  const url = String(entry.url || '').trim();
  if (!url) return null;
  const defaultName = type === 'pdf' ? 'PDF' : 'Fotoğraf';
  return {
    type,
    url,
    name: String(entry.name || '').trim() || defaultName,
  };
}

function parseMediaFilesInput(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.map(normalizeMediaFileEntry).filter(Boolean);
}

function mediaFilesFromDoc(doc) {
  if (!doc || typeof doc !== 'object') return [];
  const stored = parseMediaFilesInput(doc.mediaFiles);
  if (stored && stored.length) return stored;

  const out = [];
  const img = String(doc.imageUrl || '').trim();
  const menuImg = String(doc.menuImageUrl || '').trim();
  const menuPdf = String(doc.menuPdfUrl || '').trim();
  if (img) out.push({ type: 'image', url: img, name: 'Fotoğraf' });
  if (menuImg && menuImg !== img) out.push({ type: 'image', url: menuImg, name: 'Menü' });
  else if (menuImg && !img) out.push({ type: 'image', url: menuImg, name: 'Menü' });
  if (menuPdf) out.push({ type: 'pdf', url: menuPdf, name: 'Menü PDF' });
  return out;
}

function syncLegacyMediaFields(set) {
  const files = Array.isArray(set.mediaFiles) ? set.mediaFiles : [];
  const images = files.filter((f) => f.type === 'image' && f.url);
  const pdfs = files.filter((f) => f.type === 'pdf' && f.url);
  set.imageUrl = images[0]?.url || '';
  const menuNamed = images.find((f) => /menü|menu/i.test(f.name));
  set.menuImageUrl = menuNamed?.url || (images.length > 1 ? images[1].url : '');
  set.menuPdfUrl = pdfs[0]?.url || '';
}

function applyMediaFilesToSet(set, body) {
  if (!set || typeof set !== 'object' || !body || typeof body !== 'object') return;

  const parsed = body.mediaFiles !== undefined ? parseMediaFilesInput(body.mediaFiles) : null;
  if (parsed !== null) {
    set.mediaFiles = parsed;
    syncLegacyMediaFields(set);
    return;
  }

  const hasLegacy =
    body.imageUrl !== undefined
    || body.menuImageUrl !== undefined
    || body.menuPdfUrl !== undefined;
  if (!hasLegacy) return;

  const merged = {
    imageUrl: body.imageUrl !== undefined ? String(body.imageUrl || '').trim() : String(set.imageUrl || '').trim(),
    menuImageUrl:
      body.menuImageUrl !== undefined ? String(body.menuImageUrl || '').trim() : String(set.menuImageUrl || '').trim(),
    menuPdfUrl: body.menuPdfUrl !== undefined ? String(body.menuPdfUrl || '').trim() : String(set.menuPdfUrl || '').trim(),
  };
  set.mediaFiles = mediaFilesFromDoc(merged);
  syncLegacyMediaFields(set);
}

function enrichListingMedia(item) {
  if (!item || typeof item !== 'object') return item;
  const mediaFiles = mediaFilesFromDoc(item);
  const firstImage = mediaFiles.find((f) => f.type === 'image');
  return {
    ...item,
    mediaFiles,
    imageUrl: firstImage?.url || String(item.imageUrl || '').trim(),
  };
}

function enrichListingMediaList(list) {
  if (!Array.isArray(list)) return list;
  return list.map(enrichListingMedia);
}

module.exports = {
  listingMediaFileSchema,
  mediaFilesFromDoc,
  applyMediaFilesToSet,
  enrichListingMedia,
  enrichListingMediaList,
  syncLegacyMediaFields,
  parseMediaFilesInput,
};
