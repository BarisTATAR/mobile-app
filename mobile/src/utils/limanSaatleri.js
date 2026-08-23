/**
 * İşletme üye kaydı ve admin tekne turu: liman çıkış/geliş saatleri (saat başı).
 * 06:00 … 23:00
 */
export const LIMAN_UYE_SAAT_SECENEKLERI = Array.from({ length: 18 }, (_, i) =>
  `${String(i + 6).padStart(2, '0')}:00`
);

/** Veritabanı değerini üye listesindeki tam saate yuvarlar (06–23 arası). */
export function normalizeLimanSaatForUyeList(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const match = s.match(/^(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return '';
  let hour = mm >= 30 ? h + 1 : h;
  hour = Math.min(23, Math.max(6, hour));
  const id = `${String(hour).padStart(2, '0')}:00`;
  return LIMAN_UYE_SAAT_SECENEKLERI.includes(id) ? id : '';
}
