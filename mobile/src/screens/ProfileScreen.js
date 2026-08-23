import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';

const APP_USER_KEY = 'appUser';

function formatDateLabel(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${days[d.getDay()]}`;
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

export default function ProfileScreen() {
  const [appUser, setAppUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [yoreselTalepler, setYoreselTalepler] = useState([]);
  const [memberDiscounts, setMemberDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
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
      try {
        const res = await fetch(apiUrl(`/api/user/profile?userId=${encodeURIComponent(user.id)}`));
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.user) {
          const merged = { ...user, ...data.user, rememberMe: user.rememberMe };
          await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(merged));
          setAppUser(merged);
          return merged.id;
        }
      } catch {
        // offline: cached user
      }
      setAppUser(user);
      return user.id;
    } catch {
      setAppUser(null);
      return null;
    }
  }, []);

  const copyMemberId = useCallback(() => {
    const id = appUser?.memberId;
    if (!id) {
      Alert.alert('Üye numarası yok', 'Giriş yapın veya sayfayı yenileyin.');
      return;
    }
    Clipboard.setString(id);
    Alert.alert('Kopyalandı', 'Üye numaranız panoya kopyalandı. İşletmede indirim için bu numarayı gösterin.');
  }, [appUser?.memberId]);

  const loadReservations = useCallback(async (userId) => {
    if (!userId) {
      setReservations([]);
      setYoreselTalepler([]);
      setMemberDiscounts([]);
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
    } catch {
      setMemberDiscounts([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const userId = await loadUser();
    await loadReservations(userId);
    setLoading(false);
    setRefreshing(false);
  }, [loadUser, loadReservations]);

  const cancelReservation = useCallback((reservationId) => {
    if (!appUser?.id) return;
    Alert.alert(
      'Rezervasyonu iptal et',
      'Bu rezervasyonu iptal etmek istiyor musunuz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal et',
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
                Alert.alert('Hata', data.error || 'Rezervasyon iptal edilemedi');
                return;
              }
              await loadReservations(appUser.id);
              Alert.alert('Başarılı', 'Rezervasyonunuz iptal edildi.');
            } catch (e) {
              Alert.alert('Hata', 'Bağlantı hatası');
            } finally {
              setCancellingId('');
            }
          },
        },
      ]
    );
  }, [appUser, loadReservations]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadUser()
      .then(async (userId) => {
        if (!cancelled) await loadReservations(userId);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />
      }
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {appUser && appUser.name ? String(appUser.name).charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.name}>
          {appUser ? [appUser.name, appUser.surname].filter(Boolean).join(' ') || 'Kullanıcı' : 'Giriş yapılmadı'}
        </Text>
        {appUser && appUser.username ? (
          <Text style={styles.username}>@{appUser.username}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Üye numaram</Text>
        {appUser?.memberId ? (
          <View style={styles.memberIdCard}>
            <Text style={styles.memberIdValue}>{appUser.memberId}</Text>
            <Text style={styles.memberIdHint}>
              Bu numara size özeldir. İşletmelerde indirim kontrolü için gösterin veya kopyalayın.
            </Text>
            <TouchableOpacity style={styles.copyMemberBtn} onPress={copyMemberId} activeOpacity={0.8}>
              <Text style={styles.copyMemberBtnText}>Numarayı kopyala</Text>
            </TouchableOpacity>
          </View>
        ) : appUser ? (
          <Text style={styles.placeholder}>Üye numarası yükleniyor… Sayfayı aşağı çekerek yenileyin.</Text>
        ) : (
          <Text style={styles.placeholder}>Giriş yapınca benzersiz üye numaranız burada görünür.</Text>
        )}
      </View>

      {appUser?.memberId && memberDiscounts.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İndirimlerim</Text>
          <Text style={styles.sectionHint}>Aktif üye indirimleriniz. İşletmede üye numaranızı gösterin.</Text>
          {memberDiscounts.map((d) => (
            <View key={d._id} style={styles.discountCard}>
              {d.businessName ? (
                <Text style={styles.discountBusiness}>{d.businessName}</Text>
              ) : null}
              {d.title ? (
                <Text style={styles.discountTitle}>{d.title}</Text>
              ) : null}
              {d.discountPercent != null ? (
                <Text style={styles.discountPercent}>%{d.discountPercent} indirim</Text>
              ) : null}
              {d.validUntil ? (
                <Text style={styles.discountValidUntil}>
                  Geçerlilik: {formatDateLabel(String(d.validUntil).slice(0, 10))}
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
        <Text style={styles.sectionTitle}>Kullanıcı bilgilerim</Text>
        {appUser ? (
          <View style={styles.infoBlock}>
            <Text style={styles.infoRow}><Text style={styles.infoLabel}>Ad Soyad: </Text>{[appUser.name, appUser.surname].filter(Boolean).join(' ') || '—'}</Text>
            <Text style={styles.infoRow}><Text style={styles.infoLabel}>Kullanıcı adı: </Text>{appUser.username || '—'}</Text>
            <Text style={styles.infoRow}><Text style={styles.infoLabel}>Telefon: </Text>{appUser.phone || '—'}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>Giriş yaparak bilgilerinizi görüntüleyebilirsiniz.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mevcut rezervasyonlarım</Text>

        <Text style={styles.subSectionTitle}>Onay bekleyen rezervasyonlarım</Text>
        <Text style={styles.sectionHint}>Tarih sırasına göre (yakın tarih önce)</Text>
        {pendingList.length === 0 ? (
          <Text style={styles.emptyText}>Onay bekleyen rezervasyonunuz yok.</Text>
        ) : (
          pendingList.map((r) => (
            <View key={r._id} style={[styles.resCard, styles.resCardPending]}>
              <Text style={styles.resBusiness}>{r.business?.businessName || 'İşletme'}</Text>
              <Text style={styles.resDate}>{formatDateLabel(r.date)} — {r.slot || '—'}</Text>
              <Text style={[styles.resStatus, styles.status_pending]}>{STATUS_LABELS[r.status] || r.status}</Text>
              <TouchableOpacity
                style={[styles.cancelBtn, cancellingId === r._id && styles.cancelBtnDisabled]}
                onPress={() => cancelReservation(r._id)}
                disabled={cancellingId === r._id}
              >
                <Text style={styles.cancelBtnText}>
                  {cancellingId === r._id ? 'İptal ediliyor...' : 'Rezervasyonumu iptal et'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Onaylanan rezervasyonlarım</Text>
        <Text style={styles.sectionHint}>Tarih sırasına göre (yakın tarih önce)</Text>
        {approvedList.length === 0 ? (
          <Text style={styles.emptyText}>Onaylanan rezervasyonunuz yok.</Text>
        ) : (
          approvedList.map((r) => (
            <View key={r._id} style={styles.resCard}>
              <Text style={styles.resBusiness}>{r.business?.businessName || 'İşletme'}</Text>
              <Text style={styles.resDate}>{formatDateLabel(r.date)} — {r.slot || '—'}</Text>
              <Text style={[styles.resStatus, styles.status_approved]}>{STATUS_LABELS[r.status] || r.status}</Text>
              <TouchableOpacity
                style={[styles.cancelBtn, cancellingId === r._id && styles.cancelBtnDisabled]}
                onPress={() => cancelReservation(r._id)}
                disabled={cancellingId === r._id}
              >
                <Text style={styles.cancelBtnText}>
                  {cancellingId === r._id ? 'İptal ediliyor...' : 'Rezervasyonumu iptal et'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yöresel etkinlik taleplerim</Text>
        <Text style={styles.sectionHint}>
          Aynı talepte birden fazla hizmet seçtiyseniz, her işletme kendi onayını verir; durumlar ayrı satırlarda görünür.
        </Text>
        {!appUser?.id ? (
          <Text style={styles.emptyText}>Giriş yaparak yöresel taleplerinizi görüntüleyebilirsiniz.</Text>
        ) : yoreselTalepler.length === 0 ? (
          <Text style={styles.emptyText}>Yöresel etkinlik talebiniz yok.</Text>
        ) : (
          yoreselTalepler.map((t) => (
            <View key={t._id} style={styles.yoreselCard}>
              <Text style={styles.yoreselCardTitle}>
                {t.eventTypeLabel || t.eventType} · {formatDateLabel(t.date)}
              </Text>
              <Text style={styles.yoreselAgg}>
                Talep özeti: {YORESEL_AGG_LABELS[t.aggregateStatus] || t.aggregateStatus}
              </Text>
              {(t.serviceLines || []).map((line) => (
                <View key={`${t._id}-${line.serviceKey}`} style={styles.yoreselLine}>
                  <Text style={styles.yoreselLineMain}>
                    {line.label}: {line.isletmeName}
                    {line.timeSlotLabel ? ` · ${line.timeSlotLabel}` : ''}
                  </Text>
                  <Text
                    style={[
                      styles.yoreselLineStatus,
                      line.status === 'approved' && styles.status_approved,
                      line.status === 'rejected' && styles.status_rejected,
                      line.status === 'pending' && styles.status_pending,
                    ]}
                  >
                    {YORESEL_LINE_STATUS[line.status] || line.status}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Geçmiş rezervasyonlarım</Text>
        <Text style={styles.sectionHint}>Tarih sırasına göre (yeniden eskiye)</Text>
        {pastList.length === 0 ? (
          <Text style={styles.emptyText}>Geçmiş rezervasyonunuz yok.</Text>
        ) : (
          pastList.map((r) => (
            <View key={r._id} style={[styles.resCard, styles.resCardPast]}>
              <Text style={styles.resBusiness}>{r.business?.businessName || 'İşletme'}</Text>
              <Text style={styles.resDate}>{formatDateLabel(r.date)} — {r.slot || '—'}</Text>
              <Text style={[styles.resStatus, styles[`status_${r.status}`]]}>{STATUS_LABELS[r.status] || r.status}</Text>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C759',
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
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  copyMemberBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
    backgroundColor: '#f0f9f2',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
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
  status_approved: { color: '#34C759' },
  status_rejected: { color: '#c0392b' },
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
