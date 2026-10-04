import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Clipboard,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import { useLanguage, txNow } from '../i18n/LanguageContext';
import { attachLanguageToUser } from '../i18n/userLanguageStore';


const APP_USER_KEY = 'appUser';

function formatDateLabel(dateStr, locale) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'tr-TR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    weekday: 'short',
  });
}

const STATUS_LABELS = {
  pending: 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  completed: 'Tamamlandı',
  no_show: 'Gelmedi',
  cancelled: 'İptal edildi',
};

const YORESEL_LINE_STATUS = {
  pending: 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const YORESEL_AGG_LABELS = {
  ...YORESEL_LINE_STATUS,
  partial: 'Kısmen onaylandı',
  cancelled: 'İptal edildi',
};

const YORESEL_AUTO_REJECT_LABEL = 'Zaman aşımı, otomatik reddedilmiştir.';

function callIsletmePhone(phone) {
  const tel = String(phone || '').replace(/\D/g, '');
  if (!tel) return;
  Alert.alert(txNow('Ara'), String(phone), [
    { text: txNow('İptal'), style: 'cancel' },
    {
      text: txNow('Ara'),
      onPress: () => Linking.openURL(`tel:${tel}`).catch(() => Alert.alert(txNow('Hata'), txNow('Arama başlatılamadı'))),
    },
  ]);
}

export default function ProfileScreen() {
  const { tx, lang, setLang } = useLanguage();
  const dateLocale = lang === 'en' ? 'en' : 'tr';
  const [appUser, setAppUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [yoreselTalepler, setYoreselTalepler] = useState([]);
  const [memberDiscounts, setMemberDiscounts] = useState([]);
  const [specialDayDiscount, setSpecialDayDiscount] = useState(null);
  const [listsLoading, setListsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState('');

  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const loadUser = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(APP_USER_KEY);
      const user = raw ? JSON.parse(raw) : null;
      if (!user?.id) {
        setAppUser(null);
        return null;
      }
      const cached = await attachLanguageToUser(user, user.username);
      await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(cached));
      setAppUser(cached);
      await setLang(cached.language);
      try {
        const res = await fetch(apiUrl(`/api/user/profile?userId=${encodeURIComponent(user.id)}`));
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.user) {
          const merged = await attachLanguageToUser(
            { ...cached, ...data.user, language: data.user.language || cached.language, rememberMe: cached.rememberMe },
            cached.username
          );
          await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(merged));
          setAppUser(merged);
          await setLang(merged.language);
          return merged.id;
        }
      } catch {
        // offline: cached user
      }
      return cached.id;
    } catch {
      setAppUser(null);
      return null;
    }
  }, [setLang]);

  const copyMemberId = useCallback(() => {
    const id = appUser?.memberId;
    if (!id) {
      Alert.alert(tx('Üye numarası yok'), tx('Giriş yapın veya sayfayı yenileyin.'));
      return;
    }
    Clipboard.setString(id);
    Alert.alert(tx('Kopyalandı'), tx('Üye numaranız panoya kopyalandı. İşletmede indirim için bu numarayı gösterin.'));
  }, [appUser?.memberId, tx]);

  const loadReservations = useCallback(async (userId) => {
    if (!userId) {
      setReservations([]);
      setYoreselTalepler([]);
      setMemberDiscounts([]);
      setSpecialDayDiscount(null);
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/user/reservations?userId=${encodeURIComponent(userId)}`));
      const data = await res.json().catch(() => ({}));
      setReservations(Array.isArray(data.reservations) ? data.reservations : []);
    } catch {
      setReservations([]);
    }
    try {
      const resY = await fetch(apiUrl(`/api/user/yoresel-talepler?userId=${encodeURIComponent(userId)}`));
      const dataY = await resY.json().catch(() => ({}));
      setYoreselTalepler(Array.isArray(dataY.talepler) ? dataY.talepler : []);
    } catch {
      setYoreselTalepler([]);
    }
    try {
      const resD = await fetch(apiUrl(`/api/user/member-discounts?userId=${encodeURIComponent(userId)}`));
      const dataD = await resD.json().catch(() => ({}));
      setMemberDiscounts(Array.isArray(dataD.discounts) ? dataD.discounts : []);
      setSpecialDayDiscount(dataD.specialDayDiscount?.active ? dataD.specialDayDiscount : null);
    } catch {
      setMemberDiscounts([]);
      setSpecialDayDiscount(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const userId = await loadUser();
    await loadReservations(userId);
    setListsLoading(false);
    setRefreshing(false);
  }, [loadUser, loadReservations]);

  const cancelReservation = useCallback((reservationId) => {
    if (!appUser?.id) return;
    Alert.alert(
      tx('Rezervasyonu iptal et'),
      tx('Bu rezervasyonu iptal etmek istiyor musunuz?'),
      [
        { text: tx('Vazgeç'), style: 'cancel' },
        {
          text: tx('İptal et'),
          style: 'destructive',
          onPress: async () => {
            setCancellingId(reservationId);
            try {
              const res = await fetch(apiUrl(`/api/user/reservations/${reservationId}/cancel`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: appUser.id }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                Alert.alert(tx('Hata'), data.error || tx('Rezervasyon iptal edilemedi'));
                return;
              }
              await loadReservations(appUser.id);
              Alert.alert(tx('Başarılı'), tx('Rezervasyonunuz iptal edildi.'));
            } catch (e) {
              Alert.alert(tx('Hata'), tx('Bağlantı hatası'));
            } finally {
              setCancellingId('');
            }
          },
        },
      ]
    );
  }, [appUser, loadReservations, tx]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_USER_KEY);
        if (cancelled) return;
        const cached = raw ? JSON.parse(raw) : null;
        setAppUser(cached?.id ? cached : null);
      } catch {
        if (!cancelled) setAppUser(null);
      }
      if (cancelled) return;
      const userId = await loadUser();
      if (!cancelled) await loadReservations(userId);
      if (!cancelled) setListsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadUser, loadReservations]);

  const todayStr = today();
  const sortByDateSlot = (a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : (a.slot || '').localeCompare(b.slot || ''));
  const pendingList = reservations
    .filter((r) => r.date >= todayStr && r.status === 'pending')
    .sort(sortByDateSlot);
  const approvedList = reservations
    .filter((r) => r.date >= todayStr && r.status === 'approved')
    .sort(sortByDateSlot);
  const pastList = reservations
    .filter((r) => r.date < todayStr || ['rejected', 'completed', 'no_show', 'cancelled'].includes(r.status))
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : (b.slot || '').localeCompare(a.slot || '')));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />
      }
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {appUser && appUser.name ? String(appUser.name).charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.name}>
          {appUser ? [appUser.name, appUser.surname].filter(Boolean).join(' ') || tx('Kullanıcı') : tx('Giriş yapılmadı')}
        </Text>
        {appUser && appUser.username ? (
          <Text style={styles.username}>@{appUser.username}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tx('Üye numaram')}</Text>
        {appUser?.memberId ? (
          <View style={styles.memberIdCard}>
            <Text style={styles.memberIdValue}>{appUser.memberId}</Text>
            <Text style={styles.memberIdHint}>
              {tx('Bu numara size özeldir. İşletmelerde indirim kontrolü için gösterin veya kopyalayın.')}
            </Text>
            <TouchableOpacity style={styles.copyMemberBtn} onPress={copyMemberId} activeOpacity={0.8}>
              <Text style={styles.copyMemberBtnText}>{tx('Numarayı kopyala')}</Text>
            </TouchableOpacity>
          </View>
        ) : appUser ? (
          <Text style={styles.placeholder}>{tx('Üye numarası yükleniyor… Sayfayı aşağı çekerek yenileyin.')}</Text>
        ) : (
          <Text style={styles.placeholder}>{tx('Giriş yapınca benzersiz üye numaranız burada görünür.')}</Text>
        )}
      </View>

      {specialDayDiscount ? (
        <View style={styles.section}>
          <View style={styles.specialDayCard}>
            <Text style={styles.specialDayTitle}>{tx('🎉 Bugün özel gününüz!')}</Text>
            <Text style={styles.specialDayText}>
              {tx('Rezervasyon bölümündeki tüm işletmelerde %{percent} indirim geçerlidir. Üye numaranızı işletmeye gösterin.', {
                percent: specialDayDiscount.discountPercent || 10,
              })}
            </Text>
          </View>
        </View>
      ) : null}

      {appUser?.memberId && memberDiscounts.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx('İndirimlerim')}</Text>
          <Text style={styles.sectionHint}>{tx('Aktif üye indirimleriniz. İşletmede üye numaranızı gösterin.')}</Text>
          {memberDiscounts.map((d) => (
            <View key={d._id} style={styles.discountCard}>
              {d.businessName ? (
                <Text style={styles.discountBusiness}>{d.businessName}</Text>
              ) : null}
              {d.title ? (
                <Text style={styles.discountTitle}>{d.title}</Text>
              ) : null}
              {d.discountPercent != null ? (
                <Text style={styles.discountPercent}>{tx('%{percent} indirim', { percent: d.discountPercent })}</Text>
              ) : null}
              {d.validUntil ? (
                <Text style={styles.discountValidUntil}>
                  {tx('Geçerlilik: {date}', { date: formatDateLabel(String(d.validUntil).slice(0, 10), dateLocale) })}
                </Text>
              ) : null}
              {d.description ? (
                <Text style={styles.discountDescription}>{d.description}</Text>
              ) : null}
              {d.note ? (
                <Text style={styles.discountNote}>{d.note}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tx('Kullanıcı bilgilerim')}</Text>
        {appUser ? (
          <View style={styles.infoBlock}>
            <Text style={styles.infoRow}><Text style={styles.infoLabel}>{tx('Ad Soyad: ')}</Text>{[appUser.name, appUser.surname].filter(Boolean).join(' ') || '—'}</Text>
            <Text style={styles.infoRow}><Text style={styles.infoLabel}>{tx('Kullanıcı adı: ')}</Text>{appUser.username || '—'}</Text>
            <Text style={styles.infoRow}><Text style={styles.infoLabel}>{tx('Telefon')}: </Text>{appUser.phone || '—'}</Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>{tx('Uygulama dili')}: </Text>
              {lang === 'en' ? tx('English') : tx('Türkçe')}
            </Text>
            <Text style={styles.placeholder}>{tx('Bu hesap için dil kayıtta seçildi ve değiştirilemez.')}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>{tx('Giriş yaparak bilgilerinizi görüntüleyebilirsiniz.')}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tx('Mevcut rezervasyonlarım')}</Text>

        <Text style={styles.subSectionTitle}>{tx('Onay bekleyen rezervasyonlarım')}</Text>
        <Text style={styles.sectionHint}>{tx('Tarih sırasına göre (yakın tarih önce)')}</Text>
        {pendingList.length === 0 ? (
          <Text style={styles.emptyText}>
            {listsLoading ? tx('Yükleniyor…') : tx('Onay bekleyen rezervasyonunuz yok.')}
          </Text>
        ) : (
          pendingList.map((r) => (
            <View key={r._id} style={[styles.resCard, styles.resCardPending]}>
              <Text style={styles.resBusiness}>{r.business?.businessName || tx('İşletme')}</Text>
              <Text style={styles.resDate}>{formatDateLabel(r.date, dateLocale)} — {r.slot || '—'}</Text>
              <Text style={[styles.resStatus, styles.status_pending]}>{tx(STATUS_LABELS[r.status] || r.status)}</Text>
              <TouchableOpacity
                style={[styles.cancelBtn, cancellingId === r._id && styles.cancelBtnDisabled]}
                onPress={() => cancelReservation(r._id)}
                disabled={cancellingId === r._id}
              >
                <Text style={styles.cancelBtnText}>
                  {cancellingId === r._id ? tx('İptal ediliyor...') : tx('Rezervasyonumu iptal et')}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>{tx('Onaylanan rezervasyonlarım')}</Text>
        <Text style={styles.sectionHint}>{tx('Tarih sırasına göre (yakın tarih önce)')}</Text>
        {approvedList.length === 0 ? (
          <Text style={styles.emptyText}>
            {listsLoading ? tx('Yükleniyor…') : tx('Onaylanan rezervasyonunuz yok.')}
          </Text>
        ) : (
          approvedList.map((r) => (
            <View key={r._id} style={styles.resCard}>
              <Text style={styles.resBusiness}>{r.business?.businessName || tx('İşletme')}</Text>
              <Text style={styles.resDate}>{formatDateLabel(r.date, dateLocale)} — {r.slot || '—'}</Text>
              <Text style={[styles.resStatus, styles.status_approved]}>{tx(STATUS_LABELS[r.status] || r.status)}</Text>
              <TouchableOpacity
                style={[styles.cancelBtn, cancellingId === r._id && styles.cancelBtnDisabled]}
                onPress={() => cancelReservation(r._id)}
                disabled={cancellingId === r._id}
              >
                <Text style={styles.cancelBtnText}>
                  {cancellingId === r._id ? tx('İptal ediliyor...') : tx('Rezervasyonumu iptal et')}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tx('Yöresel etkinlik taleplerim')}</Text>
        <Text style={styles.sectionHint}>
          {tx('Aynı talepte birden fazla hizmet seçtiyseniz, her işletme kendi onayını verir; durumlar ayrı satırlarda görünür.')}
        </Text>
        {!appUser?.id ? (
          <Text style={styles.emptyText}>{tx('Giriş yaparak yöresel taleplerinizi görüntüleyebilirsiniz.')}</Text>
        ) : yoreselTalepler.length === 0 ? (
          <Text style={styles.emptyText}>
            {listsLoading ? tx('Yükleniyor…') : tx('Yöresel etkinlik talebiniz yok.')}
          </Text>
        ) : (
          yoreselTalepler.map((t) => (
            <View key={t._id} style={styles.yoreselCard}>
              <Text style={styles.yoreselCardTitle}>
                {tx(t.eventTypeLabel || t.eventType)} · {formatDateLabel(t.date, dateLocale)}
              </Text>
              <Text style={styles.yoreselAgg}>
                {tx('Talep özeti:')}{' '}
                {tx(t.aggregateStatusLabel
                  || YORESEL_AGG_LABELS[t.aggregateStatus]
                  || t.aggregateStatus)}
              </Text>
              {(t.serviceLines || []).map((line) => (
                <View key={`${t._id}-${line.serviceKey}`} style={styles.yoreselLine}>
                  <Text style={styles.yoreselLineMain}>
                    {tx(line.label)}: {line.isletmeName}
                    {line.timeSlotLabel ? ` · ${tx(line.timeSlotLabel)}` : ''}
                  </Text>
                  {line.isletmePhone ? (
                    <TouchableOpacity
                      style={styles.phoneTouch}
                      onPress={() => callIsletmePhone(line.isletmePhone)}
                    >
                      <Text style={styles.phone}>📞 {line.isletmePhone}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text
                    style={[
                      styles.yoreselLineStatus,
                      line.status === 'approved' && styles.status_approved,
                      line.status === 'rejected' && styles.status_rejected,
                      line.status === 'pending' && styles.status_pending,
                      line.autoRejected && styles.status_autoRejected,
                    ]}
                  >
                    {tx(line.statusLabel
                      || (line.autoRejected ? YORESEL_AUTO_REJECT_LABEL : null)
                      || YORESEL_LINE_STATUS[line.status]
                      || line.status)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tx('Geçmiş rezervasyonlarım')}</Text>
        <Text style={styles.sectionHint}>{tx('Tarih sırasına göre (yeniden eskiye)')}</Text>
        {pastList.length === 0 ? (
          <Text style={styles.emptyText}>
            {listsLoading ? tx('Yükleniyor…') : tx('Geçmiş rezervasyonunuz yok.')}
          </Text>
        ) : (
          pastList.map((r) => (
            <View key={r._id} style={[styles.resCard, styles.resCardPast]}>
              <Text style={styles.resBusiness}>{r.business?.businessName || tx('İşletme')}</Text>
              <Text style={styles.resDate}>{formatDateLabel(r.date, dateLocale)} — {r.slot || '—'}</Text>
              <Text style={[styles.resStatus, styles[`status_${r.status}`]]}>{tx(STATUS_LABELS[r.status] || r.status)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EB',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 56,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1B4D4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  memberIdCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  memberIdValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#1b5e20',
    textAlign: 'center',
    marginBottom: 8,
  },
  memberIdHint: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  copyMemberBtn: {
    alignSelf: 'center',
    backgroundColor: '#1B4D4A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  copyMemberBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  specialDayCard: {
    backgroundColor: '#e8f8ec',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1B4D4A',
  },
  specialDayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 8,
  },
  specialDayText: {
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20,
  },
  discountCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffe082',
    borderLeftWidth: 4,
    borderLeftColor: '#f9a825',
  },
  discountBusiness: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  discountTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  discountPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e65100',
    marginBottom: 4,
  },
  discountValidUntil: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  discountDescription: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  discountNote: {
    fontSize: 13,
    color: '#777',
    marginTop: 6,
    fontStyle: 'italic',
  },
  infoBlock: {
    marginTop: 4,
  },
  infoRow: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#555',
  },
  placeholder: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  resCard: {
    backgroundColor: '#E6F0EF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#1B4D4A',
  },
  resCardPending: {
    borderLeftColor: '#e67e22',
    backgroundColor: '#fff8f0',
  },
  resCardPast: {
    backgroundColor: '#f8f8f8',
    borderLeftColor: '#999',
  },
  resBusiness: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  resDate: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  resStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  status_pending: { color: '#e67e22' },
  status_approved: { color: '#1B4D4A' },
  status_rejected: { color: '#c0392b' },
  status_autoRejected: { color: '#7f8c8d', fontStyle: 'italic' },
  status_completed: { color: '#27ae60' },
  status_no_show: { color: '#95a5a6' },
  status_cancelled: { color: '#7f8c8d' },
  status_partial: { color: '#8e44ad' },
  yoreselCard: {
    backgroundColor: '#f4fbf6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cfe8d4',
  },
  yoreselCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 6,
  },
  yoreselSlot: {
    fontSize: 13,
    color: '#1b5e20',
    marginTop: 4,
    marginBottom: 4,
  },
  yoreselAgg: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  yoreselLine: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0ebe3',
  },
  yoreselLineMain: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  yoreselLineStatus: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  phoneTouch: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#fbe9e7',
    borderWidth: 1,
    borderColor: '#e57373',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cancelBtnDisabled: {
    opacity: 0.7,
  },
  cancelBtnText: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '700',
  },
});
