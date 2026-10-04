import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl, apiFetch } from '../config/api';
import ListingMediaFormField from '../components/ListingMediaFormField';
import { mediaFilesFromItem } from '../utils/listingMedia';
import PremiumListingsPanel from '../components/PremiumListingsPanel';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getReservationSlotsForDate,
  isDateManuallyClosed,
  formatOpeningHoursHint,
} from '../utils/reservationSlots';

const APP_BUSINESS_KEY = 'businessSession';

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = formatDateKey(new Date());
  if (dateStr === today) return 'Bugün';
  const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  return `${d.getDate()} ${days[d.getDay()]}`;
}

function getDayOfMonth(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDate();
}

function getDayLabel(dateStr) {
  const today = formatDateKey(new Date());
  if (dateStr === today) return 'Bugün';
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  return days[d.getDay()];
}

function getDateRange(startOffset, endOffset) {
  const arr = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = startOffset; i <= endOffset; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    arr.push(formatDateKey(d));
  }
  return arr;
}

const DATES = getDateRange(-7, 30);

function formatAgeCounts(r) {
  if (!r) return '';
  const a = (r.countAge0to6 || 0) + (r.countAge6to12 || 0) + (r.countAge12Plus || 0);
  if (a === 0) return '';
  const parts = [];
  if (r.countAge0to6) parts.push(`0-6 yaş: ${r.countAge0to6}`);
  if (r.countAge6to12) parts.push(`6-12 yaş: ${r.countAge6to12}`);
  if (r.countAge12Plus) parts.push(`12+ yaş: ${r.countAge12Plus}`);
  return parts.join(', ');
}

/** Tekne turu takvim özeti: yalnızca onaylanmış akış (bekleyenler sadece «Bekleyen Onaylar» sekmesinde) */
const TEKNE_SUMMARY_STATUSES = ['approved', 'completed', 'no_show'];

function sumAgeBucketsFromReservations(list) {
  let c0 = 0;
  let c6 = 0;
  let c12 = 0;
  list.forEach((r) => {
    c0 += Number(r.countAge0to6) || 0;
    c6 += Number(r.countAge6to12) || 0;
    c12 += Number(r.countAge12Plus) || 0;
  });
  return { c0, c6, c12, total: c0 + c6 + c12 };
}

export default function BusinessMainScreen({ route, navigation }) {
  const { tx } = useLanguage();
  const {
    businessId,
    businessName,
    calendarResetKey,
    activityField: activityFieldFromRoute,
    premium: premiumFromRoute,
  } = route.params || {};
  const [tab, setTab] = useState('rezervasyonlar');
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [reservationsByDate, setReservationsByDate] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dateStripRef = useRef(null);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);
  const [activityField, setActivityField] = useState(activityFieldFromRoute ?? null);
  const [openingHours, setOpeningHours] = useState(null);
  const [reservationClosedDates, setReservationClosedDates] = useState([]);
  const [limanCikisSaati, setLimanCikisSaati] = useState('');
  const [closedDatesSaving, setClosedDatesSaving] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [discountCheckLoading, setDiscountCheckLoading] = useState(false);
  const [discountCheckResult, setDiscountCheckResult] = useState(null);
  const [premium, setPremium] = useState(true);
  const [registeredDistrict, setRegisteredDistrict] = useState('');
  const [canonicalName, setCanonicalName] = useState(businessName || '');

  const isPast = (dateStr) => dateStr < formatDateKey(new Date());

  const businessForSlots = useMemo(
    () => ({
      activityField,
      openingHours,
      limanCikisSaati,
      reservationClosedDates,
    }),
    [activityField, openingHours, limanCikisSaati, reservationClosedDates]
  );

  const isSelectedDateManuallyClosed = useMemo(
    () => isDateManuallyClosed({ reservationClosedDates }, selectedDate),
    [reservationClosedDates, selectedDate]
  );

  const DATE_CHIP_WIDTH = 56 + 8;

  /** Girişte veya işletme değişince takvimi bugüne al ve şeridi kaydır */
  useEffect(() => {
    if (!businessId) return;
    const todayKey = formatDateKey(new Date());
    setSelectedDate(todayKey);
    const idx = DATES.indexOf(todayKey);
    const runScroll = () => {
      if (idx < 0 || !dateStripRef.current) return;
      const scrollX = Math.max(0, idx * DATE_CHIP_WIDTH - DATE_CHIP_WIDTH);
      dateStripRef.current.scrollTo({ x: scrollX, animated: false });
    };
    const t1 = setTimeout(runScroll, 150);
    const t2 = setTimeout(runScroll, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [businessId, calendarResetKey]);

  const fetchReservationsForDate = useCallback(async (date) => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/business/${businessId}/reservations?date=${date}`));
      const data = await res.json();
      if (res.ok) setReservationsByDate(data.reservations || []);
      else setReservationsByDate([]);
    } catch (e) {
      setReservationsByDate([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const fetchPending = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(apiUrl(`/api/business/${businessId}/reservations/pending`));
      const data = await res.json();
      if (res.ok) setPendingList(data.reservations || []);
      else setPendingList([]);
    } catch (e) {
      setPendingList([]);
    }
  }, [businessId]);

  const onSelectDate = (dateStr) => {
    setSelectedDate(dateStr);
    fetchReservationsForDate(dateStr);
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchReservationsForDate(selectedDate),
      fetchPending(),
    ]);
    setRefreshing(false);
  }, [selectedDate, fetchReservationsForDate, fetchPending]);

  const checkMemberDiscount = useCallback(async () => {
    const raw = (memberIdInput || '').trim().toUpperCase();
    if (!raw) {
      Alert.alert(tx('Uyarı'), 'Üye numarası girin.');
      return;
    }
    if (!businessId) return;
    setDiscountCheckLoading(true);
    setDiscountCheckResult(null);
    try {
      const res = await fetch(apiUrl(`/api/business/${businessId}/member-discount/check`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: raw }),
      });
      const data = await res.json().catch(() => ({}));
      setDiscountCheckResult(data);
      if (!res.ok && !data.member) {
        Alert.alert(tx('Hata'), data.error || 'Kontrol yapılamadı');
      }
    } catch {
      Alert.alert(tx('Hata'), 'Sunucuya bağlanılamadı');
    } finally {
      setDiscountCheckLoading(false);
    }
  }, [businessId, memberIdInput]);

  React.useEffect(() => {
    fetchReservationsForDate(selectedDate);
  }, [selectedDate, fetchReservationsForDate]);

  React.useEffect(() => {
    if (tab === 'bekleyen') fetchPending();
  }, [tab, fetchPending]);

  // Bekleyen sayısı sekme başlığında görünsün diye ekran açıldığında da yükle
  React.useEffect(() => {
    if (businessId) fetchPending();
  }, [businessId]);

  /** İşletme faaliyet alanı (tekne turu için günlük özet ekranı) */
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/business/${businessId}`));
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.business) {
          setActivityField(data.business.activityField || null);
          setOpeningHours(data.business.openingHours || null);
          setReservationClosedDates(
            Array.isArray(data.business.reservationClosedDates) ? data.business.reservationClosedDates : []
          );
          setLimanCikisSaati(data.business.limanCikisSaati || '');
          if (data.business.premium === true) setPremium(true);
          if (data.business.businessName) setCanonicalName(data.business.businessName);
          const dist = data.business.address?.district != null ? String(data.business.address.district).trim() : '';
          if (dist) setRegisteredDistrict(dist);
        }
      } catch (e) {
        if (!cancelled) setActivityField(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const scrollDateStripToDate = useCallback((dateStr) => {
    const idx = DATES.indexOf(dateStr);
    if (idx < 0 || !dateStripRef.current) return;
    const scrollX = Math.max(0, idx * DATE_CHIP_WIDTH - DATE_CHIP_WIDTH);
    setTimeout(() => {
      dateStripRef.current?.scrollTo({ x: scrollX, animated: true });
    }, 250);
  }, []);

  const handleApproveReject = async (reservationId, status, reservationDate) => {
    try {
      const res = await fetch(
        apiUrl(`/api/business/${businessId}/reservations/${reservationId}`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert(tx('Hata'), data.error || 'İşlem yapılamadı');
        return;
      }
      fetchPending();

      // Onay sonrası ilgili güne geç + listeyi sunucudan çek (tekne ve diğer işletmeler; activityField gerekmez)
      if (status === 'approved') {
        const d =
          (data.reservation?.date != null && String(data.reservation.date).trim()) ||
          (reservationDate != null && String(reservationDate).trim()) ||
          '';
        if (d) {
          setTab('rezervasyonlar');
          setSelectedDate(d);
          scrollDateStripToDate(d);
          await fetchReservationsForDate(d);
          return;
        }
      }
      await fetchReservationsForDate(selectedDate);
    } catch (e) {
      Alert.alert(tx('Hata'), 'Bağlantı hatası');
    }
  };

  const goToToday = () => {
    const today = formatDateKey(new Date());
    setSelectedDate(today);
    fetchReservationsForDate(today);
  };

  const fetchMenuProfile = useCallback(async () => {
    if (!businessId) return;
    setMenuLoading(true);
    try {
      const res = await apiFetch(`/api/business/${businessId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.business) {
        setMediaFiles(mediaFilesFromItem(data.business));
        if (data.business.activityField != null) setActivityField(data.business.activityField);
        if (data.business.openingHours != null) setOpeningHours(data.business.openingHours);
        setReservationClosedDates(
          Array.isArray(data.business.reservationClosedDates) ? data.business.reservationClosedDates : []
        );
        setLimanCikisSaati(data.business.limanCikisSaati || '');
      }
    } catch (e) {
      setMediaFiles([]);
    } finally {
      setMenuLoading(false);
    }
  }, [businessId]);

  const openMenuModal = () => {
    setMenuModalVisible(true);
    fetchMenuProfile();
  };

  const saveMenu = async () => {
    setMenuSaving(true);
    try {
      const res = await apiFetch(`/api/business/${businessId}/menu`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaFiles }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert(tx('Başarılı'), 'Dosyalar güncellendi.');
        if (data.business) setMediaFiles(mediaFilesFromItem(data.business));
        setMenuModalVisible(false);
      } else {
        Alert.alert(tx('Hata'), data.error || 'Kaydedilemedi');
      }
    } catch (e) {
      Alert.alert(tx('Hata'), 'Bağlantı hatası');
    } finally {
      setMenuSaving(false);
    }
  };

  const handleAttendance = (reservation) => {
    const name = reservation.user
      ? `${reservation.user.name || ''} ${reservation.user.surname || ''}`.trim()
      : reservation.guestName || 'Misafir';
    Alert.alert(
      'Giriş durumu',
      `${name} — ${reservation.slot}\nGiriş yapıldı mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Giriş oldu',
          onPress: () => setAttendance(reservation._id, 'completed'),
        },
        {
          text: 'Giriş olmadı',
          onPress: () => setAttendance(reservation._id, 'no_show'),
        },
      ]
    );
  };

  const setAttendance = async (reservationId, attendance) => {
    try {
      const res = await fetch(
        apiUrl(`/api/business/${businessId}/reservations/${reservationId}/attendance`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance }),
        }
      );
      if (res.ok) {
        fetchReservationsForDate(selectedDate);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert(tx('Hata'), err.error || 'İşlem yapılamadı');
      }
    } catch (e) {
      Alert.alert(tx('Hata'), 'Bağlantı hatası');
    }
  };

  const approvedForSlots = reservationsByDate.filter((r) => r.status === 'approved' || r.status === 'pending');
  const pastSuccess = reservationsByDate.filter((r) => r.status === 'completed');
  const pastFail = reservationsByDate.filter((r) => r.status === 'rejected' || r.status === 'no_show' || r.status === 'cancelled');
  const slotMap = {};
  approvedForSlots.forEach((r) => {
    slotMap[r.slot] = r;
  });
  const isTekneTuru = activityField === 'tekne_turu';
  const availableSlots = useMemo(() => {
    if (isTekneTuru) return [];
    return getReservationSlotsForDate(businessForSlots, selectedDate);
  }, [isTekneTuru, selectedDate, businessForSlots]);

  const toggleReservationClosedForSelectedDate = async () => {
    if (!businessId || isPast(selectedDate)) return;
    const willClose = !isSelectedDateManuallyClosed;
    Alert.alert(
      willClose ? 'Rezervasyona kapat' : 'Rezervasyona aç',
      willClose
        ? `${formatDateLabel(selectedDate)} tarihini kullanıcı rezervasyonlarına kapatmak istiyor musunuz?`
        : `${formatDateLabel(selectedDate)} tarihini tekrar rezervasyona açmak istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: willClose ? 'Kapat' : 'Aç',
          onPress: async () => {
            setClosedDatesSaving(true);
            try {
              const res = await fetch(apiUrl(`/api/business/${businessId}/reservation-closed-dates`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate, closed: willClose }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                Alert.alert(tx('Hata'), data.error || 'Kaydedilemedi');
                return;
              }
              setReservationClosedDates(
                Array.isArray(data.reservationClosedDates) ? data.reservationClosedDates : []
              );
            } catch {
              Alert.alert(tx('Hata'), 'Bağlantı hatası');
            } finally {
              setClosedDatesSaving(false);
            }
          },
        },
      ]
    );
  };
  const tekneForSummary = useMemo(
    () => reservationsByDate.filter((r) => TEKNE_SUMMARY_STATUSES.includes(r.status)),
    [reservationsByDate]
  );
  const tekneSummary = useMemo(() => sumAgeBucketsFromReservations(tekneForSummary), [tekneForSummary]);
  const tekneApprovedOnly = useMemo(
    () => reservationsByDate.filter((r) => r.status === 'approved'),
    [reservationsByDate]
  );

  const tekneReservationCount = tekneForSummary.length;

  const renderTekneDailySummary = () => (
    <View style={styles.tekneSummaryCard}>
      <Text style={styles.tekneResCountLine}>
        Bu güne ait toplam rezervasyon:{' '}
        <Text style={styles.tekneResCountNumber}>{tekneReservationCount}</Text>
      </Text>
      <Text style={styles.tekneAgeGroupsCaption}>Yaş gruplarına göre kişi</Text>
      <Text style={styles.tekneSummaryRow}>
        <Text style={styles.tekneSummaryLabel}>0–6 yaş: </Text>
        <Text style={styles.tekneSummaryValue}>{tekneSummary.c0} kişi</Text>
      </Text>
      <Text style={styles.tekneSummaryRow}>
        <Text style={styles.tekneSummaryLabel}>6–12 yaş: </Text>
        <Text style={styles.tekneSummaryValue}>{tekneSummary.c6} kişi</Text>
      </Text>
      <Text style={styles.tekneSummaryRow}>
        <Text style={styles.tekneSummaryLabel}>12+ yaş: </Text>
        <Text style={styles.tekneSummaryValue}>{tekneSummary.c12} kişi</Text>
      </Text>
      <View style={styles.tekneSummaryDivider} />
      <Text style={styles.tekneSummaryTotal}>Toplam: {tekneSummary.total} kişi</Text>
      <Text style={styles.tekneSummaryHint}>
        Onay bekleyen talepler «Bekleyen Onaylar» sekmesindedir; onaylandıktan sonra bu güne yansır. Reddedilenler
        dahil değildir.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>48 App</Text>
        <Text style={styles.subtitle}>{businessName || 'İşletme'}</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            try {
              await AsyncStorage.removeItem(APP_BUSINESS_KEY);
            } catch (e) {}
            navigation.replace('Login');
          }}
        >
          <Text style={styles.logoutText}>{tx('Çıkış')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.menuBtn} onPress={openMenuModal}>
        <Text style={styles.menuBtnText}>Fotoğraf / PDF yönet</Text>
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity
          style={[styles.tab, tab === 'rezervasyonlar' && styles.tabActive]}
          onPress={() => setTab('rezervasyonlar')}
        >
          <Text style={[styles.tabText, tab === 'rezervasyonlar' && styles.tabTextActive]} numberOfLines={1}>
            Rezervasyonlar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'bekleyen' && styles.tabActive]}
          onPress={() => setTab('bekleyen')}
        >
          <Text style={[styles.tabText, tab === 'bekleyen' && styles.tabTextActive]} numberOfLines={1}>
            Bekleyen{pendingList.length > 0 ? ` (${pendingList.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'indirim' && styles.tabActive]}
          onPress={() => setTab('indirim')}
        >
          <Text style={[styles.tabText, tab === 'indirim' && styles.tabTextActive]} numberOfLines={1}>
            İndirim
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'premium' && styles.tabActive]}
          onPress={() => setTab('premium')}
        >
          <Text style={[styles.tabText, tab === 'premium' && styles.tabTextActive]} numberOfLines={1}>
            Kampanya/İndirim
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {tab === 'rezervasyonlar' && (
        <>
          <View style={styles.dateSectionRow}>
            <Text style={styles.dateSectionTitle}>{tx('Tarih seçin')}</Text>
            <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
              <Text style={styles.todayBtnText}>{tx('Bugün')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={dateStripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateStrip}
            contentContainerStyle={styles.dateStripContent}
          >
            {DATES.map((dateStr) => {
              const manuallyClosed = isDateManuallyClosed({ reservationClosedDates }, dateStr);
              return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dateChip,
                  selectedDate === dateStr && styles.dateChipSelected,
                  isPast(dateStr) && styles.dateChipPast,
                  manuallyClosed && styles.dateChipClosed,
                ]}
                onPress={() => onSelectDate(dateStr)}
              >
                <Text
                  style={[
                    styles.dateChipDay,
                    selectedDate === dateStr && styles.dateChipDaySelected,
                  ]}
                >
                  {getDayLabel(dateStr)}
                </Text>
                <Text
                  style={[
                    styles.dateChipNum,
                    selectedDate === dateStr && styles.dateChipNumSelected,
                  ]}
                >
                  {getDayOfMonth(dateStr)}
                </Text>
                {manuallyClosed ? (
                  <Text style={styles.dateChipClosedLabel}>{tx('Kapalı')}</Text>
                ) : null}
              </TouchableOpacity>
            );
            })}
          </ScrollView>

          {!isPast(selectedDate) ? (
            <View style={styles.closedDayBar}>
              <Text style={styles.closedDayHint}>
                {formatOpeningHoursHint(businessForSlots, selectedDate)}
              </Text>
              <TouchableOpacity
                style={[
                  styles.closedDayBtn,
                  isSelectedDateManuallyClosed && styles.closedDayBtnActive,
                ]}
                onPress={toggleReservationClosedForSelectedDate}
                disabled={closedDatesSaving}
              >
                {closedDatesSaving ? (
                  <ActivityIndicator size="small" color={isSelectedDateManuallyClosed ? '#fff' : '#c62828'} />
                ) : (
                  <Text
                    style={[
                      styles.closedDayBtnText,
                      isSelectedDateManuallyClosed && styles.closedDayBtnTextActive,
                    ]}
                  >
                    {isSelectedDateManuallyClosed
                      ? 'Bu günü rezervasyona aç'
                      : 'Bu günü rezervasyona kapat'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator size="large" color="#1B4D4A" style={styles.loader} />
          ) : isPast(selectedDate) ? (
            <ScrollView
              style={styles.scroll}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />
              }
            >
              {isTekneTuru ? (
                <>
                  <Text style={styles.sectionTitle} numberOfLines={1}>Kişi özeti — {formatDateLabel(selectedDate)}</Text>
                  {reservationsByDate.length === 0 && (
                    <Text style={styles.emptyText}>Bu tarihte rezervasyon yok.</Text>
                  )}
                  {renderTekneDailySummary()}
                  <Text style={[styles.pastSectionTitle, { marginTop: 16 }]} numberOfLines={1}>Tamamlanan</Text>
                  {pastSuccess.length === 0 ? (
                    <Text style={styles.emptySub}>Yok</Text>
                  ) : (
                    pastSuccess.map((r) => (
                      <View key={r._id} style={[styles.card, styles.cardRow]}>
                        <Text style={styles.cardNameInline} numberOfLines={1}>
                          {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                        </Text>
                        {r.guestPhone ? <Text style={styles.cardPhoneInline} numberOfLines={1}>{r.guestPhone}</Text> : null}
                        {formatAgeCounts(r) ? <Text style={styles.cardAgeInline} numberOfLines={1}>{formatAgeCounts(r)}</Text> : null}
                      </View>
                    ))
                  )}
                  <Text style={[styles.pastSectionTitle, { marginTop: 16 }]} numberOfLines={1}>Başarısız</Text>
                  {pastFail.length === 0 ? (
                    <Text style={styles.emptySub}>Yok</Text>
                  ) : (
                    pastFail.map((r) => (
                      <View key={r._id} style={[styles.card, styles.cardFail, styles.cardRow]}>
                        <Text style={styles.cardNameInline} numberOfLines={1}>
                          {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                        </Text>
                        <Text style={styles.cardStatusInline} numberOfLines={1}>
                          {r.status === 'rejected' ? 'Reddedildi' : r.status === 'cancelled' ? 'İptal' : 'Gelmedi'}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.pastSectionTitle} numberOfLines={1}>{tx('Başarılı')}</Text>
                  {(pastSuccess.length === 0 && pastFail.length === 0) && (
                    <Text style={styles.emptyText}>Bu tarihte rezervasyon yok.</Text>
                  )}
                  {pastSuccess.length === 0 ? (
                    <Text style={styles.emptySub}>Yok</Text>
                  ) : (
                    pastSuccess.map((r) => (
                      <View key={r._id} style={[styles.card, styles.cardRow]}>
                        <Text style={styles.cardSlotInline}>{r.slot}</Text>
                        <Text style={styles.cardNameInline} numberOfLines={1}>
                          {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                        </Text>
                        {r.guestPhone ? <Text style={styles.cardPhoneInline} numberOfLines={1}>{r.guestPhone}</Text> : null}
                        {formatAgeCounts(r) ? <Text style={styles.cardAgeInline} numberOfLines={1}>{formatAgeCounts(r)}</Text> : null}
                      </View>
                    ))
                  )}
                  <Text style={[styles.pastSectionTitle, { marginTop: 16 }]} numberOfLines={1}>Başarısız</Text>
                  {pastFail.length === 0 ? (
                    <Text style={styles.emptySub}>Yok</Text>
                  ) : (
                    pastFail.map((r) => (
                      <View key={r._id} style={[styles.card, styles.cardFail, styles.cardRow]}>
                        <Text style={styles.cardSlotInline}>{r.slot}</Text>
                        <Text style={styles.cardNameInline} numberOfLines={1}>
                          {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                        </Text>
                        <Text style={styles.cardStatusInline} numberOfLines={1}>
                          {r.status === 'rejected' ? 'Reddedildi' : r.status === 'cancelled' ? 'İptal' : 'Gelmedi'}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          ) : isTekneTuru ? (
            <ScrollView
              style={styles.scroll}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />
              }
            >
              <Text style={styles.sectionTitle} numberOfLines={1}>Kişi özeti — {formatDateLabel(selectedDate)}</Text>
              {reservationsByDate.length === 0 && !loading && (
                <Text style={styles.emptyText}>Bu tarihte kayıt yok.</Text>
              )}
              {renderTekneDailySummary()}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]} numberOfLines={1}>Onaylı — giriş durumu</Text>
              {tekneApprovedOnly.length === 0 ? (
                <Text style={styles.emptySub}>Onaylı rezervasyon yok. Bekleyenler &quot;Bekleyen Onaylar&quot; sekmesinde.</Text>
              ) : (
                tekneApprovedOnly.map((r) => (
                  <TouchableOpacity
                    key={r._id}
                    style={[styles.card, styles.cardTappable, styles.cardRow, styles.tekneListCard]}
                    onPress={() => handleAttendance(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardNameInline} numberOfLines={1}>
                      {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                    </Text>
                    {(r.guestPhone || r.user?.phone) ? (
                      <Text style={styles.cardPhoneInline} numberOfLines={1}>{r.guestPhone || r.user.phone}</Text>
                    ) : null}
                    {formatAgeCounts(r) ? <Text style={styles.cardAgeInline} numberOfLines={1}>{formatAgeCounts(r)}</Text> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.scroll}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />
              }
            >
              <Text style={styles.sectionTitle} numberOfLines={1}>Dilimler — {formatDateLabel(selectedDate)}</Text>
              {availableSlots.length === 0 ? (
                <Text style={styles.emptyText}>
                  {isSelectedDateManuallyClosed
                    ? 'Bu gün rezervasyona kapalı (takvimden kapattınız).'
                    : 'Bu tarihte kapalı veya açılış/kapanış saati tanımlı değil.'}
                </Text>
              ) : reservationsByDate.length === 0 && !loading ? (
                <Text style={styles.emptyText}>Bu tarihte onaylı rezervasyon yok.</Text>
              ) : null}
              {availableSlots.map((slot) => {
                const r = slotMap[slot];
                return (
                  <View key={slot} style={styles.slotRow}>
                    <Text style={styles.slotTime}>{slot}</Text>
                    <View style={styles.slotContent}>
                      {r ? (
                        r.status === 'approved' ? (
                          <TouchableOpacity
                            style={[styles.card, styles.cardTappable, styles.cardRow]}
                            onPress={() => handleAttendance(r)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.cardNameInline} numberOfLines={1}>
                              {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                            </Text>
                            {(r.guestPhone || r.user?.phone) ? (
                              <Text style={styles.cardPhoneInline} numberOfLines={1}>{r.guestPhone || r.user.phone}</Text>
                            ) : null}
                            {formatAgeCounts(r) ? <Text style={styles.cardAgeInline} numberOfLines={1}>{formatAgeCounts(r)}</Text> : null}
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.card, r.status === 'pending' && styles.cardPending, styles.cardRow]}>
                            <Text style={styles.cardNameInline} numberOfLines={1}>
                              {r.user ? `${r.user.name} ${r.user.surname || ''}`.trim() : r.guestName || 'Misafir'}
                            </Text>
                            {r.guestPhone ? <Text style={styles.cardPhoneInline} numberOfLines={1}>{r.guestPhone}</Text> : null}
                            {formatAgeCounts(r) ? <Text style={styles.cardAgeInline} numberOfLines={1}>{formatAgeCounts(r)}</Text> : null}
                            {r.status === 'pending' && (
                              <Text style={styles.badgePendingInline}>Beklemede</Text>
                            )}
                          </View>
                        )
                      ) : (
                        <Text style={styles.slotEmpty}>—</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {tab === 'indirim' && (
        <ScrollView
          style={styles.discountScroll}
          contentContainerStyle={styles.discountScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.discountTitle}>Üye indirimi kontrolü</Text>
          <Text style={styles.discountHint}>
            Müşterinin profil sayfasındaki üye numarasını girin. Admin panelinden bu numaraya tanımlı indirim varsa doğrulanır.
          </Text>
          <Text style={styles.discountLabel}>Üye numarası</Text>
          <TextInput
            style={styles.discountInput}
            value={memberIdInput}
            onChangeText={(t) => setMemberIdInput(t.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
            placeholder={tx('Örn. 48X7K9M2')}
            placeholderTextColor="#999"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.discountCheckBtn, discountCheckLoading && styles.discountCheckBtnDisabled]}
            onPress={checkMemberDiscount}
            disabled={discountCheckLoading}
          >
            {discountCheckLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.discountCheckBtnText}>Kontrol et</Text>
            )}
          </TouchableOpacity>
          {discountCheckResult ? (
            <View
              style={[
                styles.discountResultCard,
                discountCheckResult.valid ? styles.discountResultValid : styles.discountResultInvalid,
              ]}
            >
              {discountCheckResult.member ? (
                <Text style={styles.discountResultMember}>
                  Üye: {discountCheckResult.member.displayName || '—'}
                  {discountCheckResult.member.memberId ? ` (${discountCheckResult.member.memberId})` : ''}
                </Text>
              ) : null}
              {discountCheckResult.valid ? (
                <>
                  <Text style={styles.discountResultStatus}>Geçerli indirim</Text>
                  {discountCheckResult.discount?.title ? (
                    <Text style={styles.discountResultLine}>{discountCheckResult.discount.title}</Text>
                  ) : null}
                  {discountCheckResult.discount?.description ? (
                    <Text style={styles.discountResultSub}>{discountCheckResult.discount.description}</Text>
                  ) : null}
                  {discountCheckResult.discount?.discountPercent != null ? (
                    <Text style={styles.discountResultPct}>
                      İndirim: %{discountCheckResult.discount.discountPercent}
                    </Text>
                  ) : null}
                  {discountCheckResult.discount?.validUntil ? (
                    <Text style={styles.discountResultSub}>
                      Son geçerlilik: {discountCheckResult.discount.validUntil}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.discountResultError}>
                  {discountCheckResult.error || 'İndirim geçerli değil'}
                </Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}

      {tab === 'premium' ? (
        <PremiumListingsPanel
          ownerType="isletme"
          ownerId={businessId}
          loginKey={canonicalName || businessName || ''}
          displayName={canonicalName || businessName || ''}
          registeredDistrict={registeredDistrict}
        />
      ) : null}

      {tab === 'bekleyen' && (
        <FlatList
          data={pendingList}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />
          }
          ListEmptyComponent={
            !refreshing && pendingList.length === 0 ? (
              <Text style={styles.emptyText}>Bekleyen onay yok.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingLabel}>Rezervasyon tarih / saati</Text>
              <Text style={styles.pendingDate}>{item.date} — {item.slot}</Text>

              <Text style={styles.pendingLabel}>Kullanıcı (isim-soyisim)</Text>
              <Text style={styles.pendingName}>
                {item.user ? `${item.user.name || ''} ${item.user.surname || ''}`.trim() || '—' : item.guestName || 'Misafir'}
              </Text>

              <Text style={styles.pendingLabel}>Cep telefonu</Text>
              <Text style={styles.pendingPhone}>{item.guestPhone || (item.user && item.user.phone) || '—'}</Text>

              <Text style={styles.pendingLabel}>Yaşlara göre kişi sayısı</Text>
              <Text style={styles.cardAgeCounts}>
                {formatAgeCounts(item) || '0-6: 0, 6-12: 0, 12+: 0'}
              </Text>

              {item.note ? (
                <>
                  <Text style={styles.pendingLabel}>{tx('Not')}</Text>
                  <Text style={styles.pendingNote}>{item.note}</Text>
                </>
              ) : null}
              <View style={styles.pendingActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApproveReject(item._id, 'approved', item.date)}
                >
                  <Text style={styles.actionBtnText}>Onayla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleApproveReject(item._id, 'rejected')}
                >
                  <Text style={styles.actionBtnText}>Reddet</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={menuModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setMenuModalVisible(false)} />
          <View style={styles.menuModalBox}>
            <Text style={styles.menuModalTitle}>{tx('Fotoğraf / PDF')}</Text>
            {menuLoading ? (
              <ActivityIndicator size="large" color="#1B4D4A" style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={styles.menuModalScroll} showsVerticalScrollIndicator={false}>
                <ListingMediaFormField value={mediaFiles} onChange={setMediaFiles} label="Dosyalar" />
                <View style={styles.menuModalActions}>
                  <TouchableOpacity style={styles.menuCancelBtn} onPress={() => setMenuModalVisible(false)}>
                    <Text style={styles.menuCancelBtnText}>{tx('İptal')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuSaveBtn, menuSaving && styles.menuUploadBtnDisabled]}
                    onPress={saveMenu}
                    disabled={menuSaving}
                  >
                    {menuSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.menuSaveBtnText}>{tx('Kaydet')}</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EB',
  },
  header: {
    backgroundColor: '#1B4D4A',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  logoutBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    padding: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuBtn: {
    backgroundColor: '#e65100',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  menuBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  menuModalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  menuModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  menuModalScroll: {
    maxHeight: 400,
  },
  menuPreviewWrap: { marginBottom: 16 },
  menuPreviewLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  menuPreviewImg: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#eee' },
  menuPdfLabel: { fontSize: 13, color: '#1B4D4A', marginBottom: 12 },
  menuUploadBtn: {
    backgroundColor: '#1B4D4A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  menuUploadBtnSecondary: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#1B4D4A' },
  menuUploadBtnDisabled: { opacity: 0.7 },
  menuUploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  menuUploadBtnTextSecondary: { color: '#1B4D4A' },
  menuModalActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  menuCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#eee', alignItems: 'center' },
  menuCancelBtnText: { fontSize: 16, fontWeight: '600', color: '#666' },
  menuSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#1B4D4A', alignItems: 'center' },
  menuSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tabsScroll: {
    flexGrow: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabsContent: {
    paddingHorizontal: 4,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#1B4D4A',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1B4D4A',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  dateSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  todayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1B4D4A',
  },
  todayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dateStrip: {
    maxHeight: 80,
  },
  dateStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateChip: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  dateChipSelected: {
    backgroundColor: '#1B4D4A',
    borderColor: '#1B4D4A',
  },
  dateChipPast: {
    opacity: 0.85,
  },
  dateChipClosed: {
    backgroundColor: '#ffebee',
    borderColor: '#ef9a9a',
  },
  dateChipClosedLabel: {
    fontSize: 9,
    color: '#c62828',
    fontWeight: '700',
    marginTop: 2,
  },
  closedDayBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  closedDayHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 17,
  },
  closedDayBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#c62828',
    alignItems: 'center',
  },
  closedDayBtnActive: {
    backgroundColor: '#c62828',
    borderColor: '#c62828',
  },
  closedDayBtnText: {
    color: '#c62828',
    fontWeight: '700',
    fontSize: 14,
  },
  closedDayBtnTextActive: {
    color: '#fff',
  },
  dateChipDay: {
    fontSize: 11,
    color: '#666',
  },
  dateChipDaySelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  dateChipNum: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  dateChipNumSelected: {
    color: '#fff',
  },
  scroll: {
    flex: 1,
  },
  loader: {
    marginTop: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  emptySub: {
    color: '#999',
    fontSize: 14,
    marginLeft: 20,
    marginTop: 4,
  },
  pastSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  slotTime: {
    width: 52,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  slotContent: {
    flex: 1,
  },
  slotEmpty: {
    color: '#bbb',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#E6F0EF',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#1B4D4A',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardPending: {
    borderLeftColor: '#FF9500',
    backgroundColor: '#fff9f0',
  },
  cardTappable: {
    borderLeftColor: '#0d6efd',
  },
  cardFail: {
    backgroundColor: '#fff0f0',
    borderLeftColor: '#dc3545',
  },
  cardSlotInline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    minWidth: 42,
  },
  cardNameInline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  cardPhoneInline: {
    fontSize: 12,
    color: '#666',
  },
  cardAgeInline: {
    fontSize: 11,
    color: '#888',
  },
  cardStatusInline: {
    fontSize: 12,
    color: '#dc3545',
    fontWeight: '600',
  },
  badgePendingInline: {
    fontSize: 11,
    color: '#FF9500',
    fontWeight: '700',
  },
  cardSlot: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  cardPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cardAgeCounts: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  cardStatus: {
    fontSize: 13,
    color: '#dc3545',
    marginTop: 2,
  },
  badgePending: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
    fontWeight: '600',
  },
  pendingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pendingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 2,
  },
  pendingDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  pendingName: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  pendingPhone: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  pendingNote: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
    fontStyle: 'italic',
  },
  pendingActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#1B4D4A',
  },
  rejectBtn: {
    backgroundColor: '#dc3545',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  tekneResCountLine: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  tekneResCountNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1b5e20',
  },
  tekneAgeGroupsCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    marginTop: 2,
  },
  tekneSummaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8e6c9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tekneSummaryRow: {
    fontSize: 16,
    marginBottom: 8,
  },
  tekneSummaryLabel: {
    color: '#555',
    fontWeight: '600',
  },
  tekneSummaryValue: {
    color: '#111',
    fontWeight: '700',
  },
  tekneSummaryDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
  tekneSummaryTotal: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  tekneSummaryHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 10,
    lineHeight: 15,
  },
  tekneListCard: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  discountScroll: {
    flex: 1,
  },
  discountScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  discountTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  discountHint: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  discountInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#1b5e20',
    marginBottom: 16,
  },
  discountCheckBtn: {
    backgroundColor: '#1B4D4A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  discountCheckBtnDisabled: {
    opacity: 0.7,
  },
  discountCheckBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  discountResultCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  discountResultValid: {
    backgroundColor: '#e8f5e9',
    borderColor: '#81c784',
  },
  discountResultInvalid: {
    backgroundColor: '#ffebee',
    borderColor: '#e57373',
  },
  discountResultMember: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  discountResultStatus: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1b5e20',
    marginBottom: 6,
  },
  discountResultLine: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  discountResultSub: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  discountResultPct: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2e7d32',
    marginTop: 8,
  },
  discountResultError: {
    fontSize: 15,
    color: '#c62828',
    fontWeight: '600',
  },
});
