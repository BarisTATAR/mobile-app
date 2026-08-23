export function mediaFilesFromItem(item) {
  if (!item || typeof item !== 'object') return [];
  if (Array.isArray(item.mediaFiles) && item.mediaFiles.length) {
    return item.mediaFiles
      .map((f) => ({
        type: f?.type === 'pdf' ? 'pdf' : f?.type === 'video' ? 'video' : 'image',
        url: String(f?.url || '').trim(),
        name: String(f?.name || '').trim() || (f?.type === 'pdf' ? 'PDF' : 'Fotoğraf'),
      }))
      .filter((f) => f.url);
  }
  const out = [];
  const img = String(item.imageUrl || '').trim();
  const menuImg = String(item.menuImageUrl || '').trim();
  const menuPdf = String(item.menuPdfUrl || '').trim();
  if (img) out.push({ type: 'image', url: img, name: 'Fotoğraf' });
  if (menuImg && menuImg !== img) out.push({ type: 'image', url: menuImg, name: 'Menü' });
  else if (menuImg && !img) out.push({ type: 'image', url: menuImg, name: 'Menü' });
  if (menuPdf) out.push({ type: 'pdf', url: menuPdf, name: 'Menü PDF' });
  return out;
}

export function listingImageFiles(item) {
  return mediaFilesFromItem(item).filter((f) => f.type === 'image');
}

export function listingPdfFiles(item) {
  return mediaFilesFromItem(item).filter((f) => f.type === 'pdf');
}

/** Kullanıcı galerisinde sırayla gösterilecek tüm medya (fotoğraf, video, PDF) */
export function listingGalleryItems(item) {
  return mediaFilesFromItem(item).filter((f) =>
    f.type === 'image' || f.type === 'pdf' || f.type === 'video'
  );
}

export function listingHasMedia(item) {
  return mediaFilesFromItem(item).length > 0;
}

export function primaryListingImageUrl(item) {
  const images = listingImageFiles(item);
  return images[0]?.url || String(item?.imageUrl || '').trim();
}
