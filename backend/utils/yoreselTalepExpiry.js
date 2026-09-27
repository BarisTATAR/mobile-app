const YORESEL_PENDING_TIMEOUT_MS = 72 * 60 * 60 * 1000;
const YORESEL_AUTO_REJECT_LABEL = 'Zaman aşımı, otomatik reddedilmiştir.';

function yoreselStatusLabelForIsletme(row, status) {
  if (status === 'rejected' && row && row.autoRejected) {
    return YORESEL_AUTO_REJECT_LABEL;
  }
  return null;
}

function isYoreselPendingTimedOut(talep) {
  if (!talep || talep.manualEntry) return false;
  const created = talep.createdAt ? new Date(talep.createdAt).getTime() : 0;
  if (!Number.isFinite(created) || created <= 0) return false;
  return Date.now() - created >= YORESEL_PENDING_TIMEOUT_MS;
}

/**
 * 72 saatten eski bekleyen yöresel talepleri otomatik reddeder.
 * Onaylanmış işletme satırlarına dokunulmaz; manuel kayıtlar hariç tutulur.
 * Reddedilen satırlar takvimden ve çakışma kontrolünden çıkar; başkaları rezervasyon açabilir.
 */
async function expireStaleYoreselTalepler(
  YoreselEtkinlikTalep,
  { yoreselEnsureIsletmeStatuses, yoreselRecomputeAggregateStatusFromIsletmeRows }
) {
  if (!YoreselEtkinlikTalep) return 0;
  const cutoff = new Date(Date.now() - YORESEL_PENDING_TIMEOUT_MS);
  const taleps = await YoreselEtkinlikTalep.find({
    manualEntry: { $ne: true },
    status: { $in: ['pending', 'partial'] },
    createdAt: { $lte: cutoff },
  });
  let changed = 0;
  for (const talep of taleps) {
    yoreselEnsureIsletmeStatuses(talep);
    let anyChanged = false;
    for (const entry of talep.isletmeStatuses) {
      if (entry.status === 'pending') {
        entry.status = 'rejected';
        entry.autoRejected = true;
        anyChanged = true;
      }
    }
    if (!anyChanged) continue;
    if (!talep.autoRejectedAt) talep.autoRejectedAt = new Date();
    yoreselRecomputeAggregateStatusFromIsletmeRows(talep);
    talep.markModified('isletmeStatuses');
    await talep.save();
    changed += 1;
  }
  return changed;
}

module.exports = {
  YORESEL_PENDING_TIMEOUT_MS,
  YORESEL_AUTO_REJECT_LABEL,
  yoreselStatusLabelForIsletme,
  isYoreselPendingTimedOut,
  expireStaleYoreselTalepler,
};
