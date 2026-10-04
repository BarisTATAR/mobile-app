import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import YoreselAvailabilityCalendar from '../components/YoreselAvailabilityCalendar';
import ListingCardMedia from '../components/ListingCardMedia';
import ListingMediaGalleryModal from '../components/ListingMediaGalleryModal';
import { listingHasMedia } from '../utils/listingMedia';
import { useLanguage } from '../i18n/LanguageContext';
import {
  YORESEL_TIME_SLOT_OPTIONS,
  defaultYoreselServiceTimeSlots,
  yoreselTimeSlotLabel,
} from '../constants/yoreselTimeSlots';

const APP_USER_KEY = 'appUser';

const EVENT_TYPES = [
  { id: 'dugun', title: 'Düğün', emoji: '💒' },
  { id: 'nisan', title: 'Nişan', emoji: '💍' },
  { id: 'kina', title: 'Kına', emoji: '🪔' },
  { id: 'sunnet', title: 'Sünnet', emoji: '🎉' },
  { id: 'bekarliga_veda', title: 'Bekarlığa Veda', emoji: '🥳' },
  { id: 'asker_eglencesi', title: 'Asker Eğlencesi', emoji: '🎖️' },
  { id: 'dogum_gunu', title: 'Doğum günü', emoji: '🎂' },
];

const SERVICE_OPTIONS = [
  { key: 'muzisyen', label: 'Müzisyen' },
  { key: 'asci', label: 'Aşçı' },
  { key: 'susleme', label: 'Süsleme / organizasyon' },
  { key: 'zurna', label: 'Zurna ekibi' },
  { key: 'parkSalon', label: 'Park / salon' },
  { key: 'mekan', label: 'Mekan' },
  { key: 'kuafor', label: 'Kuaför' },
  { key: 'aracKiralama', label: 'Araç kiralama' },
];
const SERVICE_TAG_BY_KEY = {
  muzisyen: 'muzisyen',
  asci: 'asci',
  susleme: 'susleme',
  zurna: 'zurna',
  parkSalon: 'park_salon',
  mekan: 'mekan',
  kuafor: 'kuafor',
  aracKiralama: 'arac_kiralama',
};

const ALAN_OPTIONS = [
  { id: '', label: 'Tümü' },
  { id: 'muzisyen', label: 'Müzisyen' },
  { id: 'asci', label: 'Aşçı' },
  { id: 'susleme', label: 'Süsleme / organizasyon' },
  { id: 'zurna', label: 'Zurna ekibi' },
  { id: 'park_salon', label: 'Park / salon' },
  { id: 'mekan', label: 'Mekan' },
  { id: 'kuafor', label: 'Kuaför' },
  { id: 'arac_kiralama', label: 'Araç kiralama' },
];

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDateOptions() {
  const arr = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 365; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = formatDateKey(d);
    const label = i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    arr.push({ key, label });
  }
  return arr;
}

const DATE_OPTIONS = getDateOptions();

export default function EtkinliklerScreen({ navigation }) {
  const { tx, lang } = useLanguage();

  useEffect(() => {
    if (lang === 'en') {
      navigation.goBack();
    }
  }, [lang, navigation]);
  const [appUser, setAppUser] = useState(null);
  const [isletmeler, setIsletmeler] = useState([]);
  const [loadingIsletmeler, setLoadingIsletmeler] = useState(false);

  const [eventDate, setEventDate] = useState(DATE_OPTIONS[0]?.key || '');
  const [eventType, setEventType] = useState(EVENT_TYPES[0].id);
  const [serviceTimeSlots, setServiceTimeSlots] = useState(defaultYoreselServiceTimeSlots);
  const [services, setServices] = useState({
    muzisyen: false,
    asci: false,
    susleme: false,
    zurna: false,
    parkSalon: false,
    mekan: false,
    kuafor: false,
    aracKiralama: false,
  });
  const [serviceTargets, setServiceTargets] = useState({
    muzisyen: '',
    asci: '',
    susleme: '',
    zurna: '',
    parkSalon: '',
    mekan: '',
    kuafor: '',
    aracKiralama: '',
  });
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentFee, setPaymentFee] = useState(0);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentPaid, setPaymentPaid] = useState(true);
  const [paymentConfigured, setPaymentConfigured] = useState(false);
  const [paymentStatusLoaded, setPaymentStatusLoaded] = useState(false);

  const [dateModal, setDateModal] = useState(false);
  const [eventTypeModal, setEventTypeModal] = useState(false);
  const [serviceTimeSlotModalKey, setServiceTimeSlotModalKey] = useState('');
  const [servicePickerKey, setServicePickerKey] = useState('');
  const [serviceIsletmeModal, setServiceIsletmeModal] = useState(false);

  const [calAlan, setCalAlan] = useState('');
  const [calIsletmeId, setCalIsletmeId] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calByDate, setCalByDate] = useState({});
  const [calOfferedSlots, setCalOfferedSlots] = useState(['gunduz', 'aksam', 'tam_gun']);
  const [calLoading, setCalLoading] = useState(false);
  const [calLoaded, setCalLoaded] = useState(false);
  const [yearModal, setYearModal] = useState(false);
  const [alanModal, setAlanModal] = useState(false);
  const [calIsletmeModal, setCalIsletmeModal] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const openGallery = useCallback((items, index = 0) => {
    if (!items?.length) return;
    setGalleryItems(items);
    setGalleryIndex(index);
    setGalleryVisible(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(APP_USER_KEY).then((raw) => {
      if (cancelled) return;
      try {
        const user = raw ? JSON.parse(raw) : null;
        setAppUser(user && user.id ? user : null);
      } catch {
        setAppUser(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadIsletmeler = useCallback(async () => {
    setLoadingIsletmeler(true);
    try {
      const res = await fetch(apiUrl('/api/yoresel-etkinlik/isletmeler'));
      const data = await res.json().catch(() => ({}));
      if (res.ok) setIsletmeler(Array.isArray(data.isletmeler) ? data.isletmeler : []);
      else setIsletmeler([]);
    } catch {
      setIsletmeler([]);
    } finally {
      setLoadingIsletmeler(false);
    }
  }, []);

  useEffect(() => {
    loadIsletmeler();
  }, [loadIsletmeler]);

  const loadPaymentStatus = useCallback(async () => {
    try {
      const q = appUser?.id ? `?userId=${encodeURIComponent(appUser.id)}` : '';
      const res = await fetch(apiUrl(`/api/payments/yoresel/status${q}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPaymentRequired(false);
        setPaymentPaid(true);
        setPaymentFee(0);
        return;
      }
      const fee = Number(data.fee) || 0;
      setPaymentFee(fee);
      setPaymentRequired(!!data.required);
      setPaymentPaid(data.paid !== false);
      setPaymentConfigured(!!data.paymentConfigured);
    } catch {
      setPaymentRequired(false);
      setPaymentPaid(true);
    } finally {
      setPaymentStatusLoaded(true);
    }
  }, [appUser?.id]);

  useEffect(() => {
    loadPaymentStatus();
  }, [loadPaymentStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadPaymentStatus();
    });
    return () => sub.remove();
  }, [loadPaymentStatus]);

  const isletmelerForService = useCallback((serviceKey) => {
    const tag = SERVICE_TAG_BY_KEY[serviceKey];
    if (!tag) return [];
    return isletmeler.filter((x) => (x.serviceTags || []).includes(tag));
  }, [isletmeler]);

  const isletmelerForCalendar = useMemo(() => {
    if (!calAlan) return isletmeler;
    return isletmeler.filter((x) => (x.serviceTags || []).includes(calAlan));
  }, [isletmeler, calAlan]);

  const slotOptionsForService = useCallback((serviceKey) => {
    const targetId = serviceTargets[serviceKey];
    if (!targetId) return YORESEL_TIME_SLOT_OPTIONS;
    const ven = isletmeler.find((x) => x._id === targetId);
    const offered = ven?.offeredTimeSlots;
    if (!Array.isArray(offered) || offered.length === 0) return YORESEL_TIME_SLOT_OPTIONS;
    const filtered = YORESEL_TIME_SLOT_OPTIONS.filter((o) => offered.includes(o.id));
    return filtered.length > 0 ? filtered : YORESEL_TIME_SLOT_OPTIONS;
  }, [isletmeler, serviceTargets]);

  const toggleService = (key) => {
    setServices((prev) => {
      const next = !prev[key];
      if (!next) {
        setServiceTargets((st) => ({ ...st, [key]: '' }));
      } else {
        setServiceTimeSlots((st) => ({ ...st, [key]: st[key] || 'gunduz' }));
      }
      return { ...prev, [key]: next };
    });
  };

  const pickServiceIsletme = (serviceKey, isletmeId) => {
    setServiceTargets((st) => ({ ...st, [serviceKey]: isletmeId }));
    const ven = isletmeler.find((x) => x._id === isletmeId);
    const offered = ven?.offeredTimeSlots;
    if (!Array.isArray(offered) || offered.length === 0) return;
    setServiceTimeSlots((st) => {
      const current = st[serviceKey] || 'gunduz';
      if (offered.includes(current)) return st;
      return { ...st, [serviceKey]: offered[0] };
    });
  };

  const submitTalep = async () => {
    const anySvc = Object.values(services).some(Boolean);
    if (!anySvc) {
      Alert.alert(tx('Uyarı'), 'En az bir hizmet alanı seçin.');
      return;
    }
    if (!appUser?.id) {
      Alert.alert(
        'Üye girişi gerekli',
        'Yöresel etkinlik rezervasyonu için üye olmalısınız.',
        [
          { text: 'Tamam', style: 'cancel' },
          { text: 'Giriş yap', onPress: () => navigation.navigate('UserLogin') },
        ]
      );
      return;
    }
    if (paymentRequired && !paymentPaid) {
      Alert.alert(
        'Ödeme gerekli',
        `Talep göndermek için yöresel rezervasyon bedelini (${paymentFee} TL) kart ile ödemelisiniz.`
      );
      return;
    }
    setSending(true);
    try {
      const body = {
        date: eventDate,
        eventType,
        services,
        note: note.trim(),
        userId: appUser.id,
      };
      body.serviceTargets = serviceTargets;
      const slotsOut = {};
      Object.keys(services).forEach((k) => {
        if (services[k]) slotsOut[k] = serviceTimeSlots[k] || 'gunduz';
      });
      body.serviceTimeSlots = slotsOut;
      const res = await fetch(apiUrl('/api/yoresel-etkinlik/talep'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error || 'Talep gönderilemedi.';
        if (res.status === 402 || data.code === 'PAYMENT_REQUIRED') {
          await loadPaymentStatus();
          Alert.alert(tx('Ödeme gerekli'), errMsg);
        } else if (res.status === 429 || data.code === 'DAILY_LIMIT' || data.code === 'PERIOD_LIMIT') {
          Alert.alert(tx('Uyarı'), errMsg);
        } else {
          Alert.alert(tx('Hata'), errMsg);
        }
        return;
      }
      const contactNote = 'Rezervasyonlarınızın onaylanması için işletmeler ile iletişime geçmelisiniz.';
      let successMsg = data.message || 'Talebiniz iletildi.';
      successMsg += `\n\n${contactNote}`;
      if (data.periodLimitReached) {
        successMsg += '\n\n30 gün içindeki Yöresel Etkinlik rezervasyon limitine ulaştınız.';
      } else if (data.dailyLimitReached) {
        successMsg += '\n\nGünlük Yöresel Etkinlik rezervasyon limitine ulaştınız.';
      }
      Alert.alert(tx('Başarılı'), successMsg);
      setNote('');
      loadPaymentStatus();
    } catch {
      Alert.alert(tx('Hata'), 'Bağlantı hatası.');
    } finally {
      setSending(false);
    }
  };

  const fetchCalendar = useCallback(async () => {
    if (!calIsletmeId) {
      setCalByDate({});
      setCalLoaded(false);
      return;
    }
    setCalLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/yoresel-etkinlik/isletmeler/${calIsletmeId}/takvim?year=${calYear}`)
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCalByDate({});
        setCalLoaded(false);
        return;
      }
      setCalByDate(data.byDate && typeof data.byDate === 'object' ? data.byDate : {});
      if (Array.isArray(data.offeredTimeSlots) && data.offeredTimeSlots.length > 0) {
        setCalOfferedSlots(data.offeredTimeSlots);
      }
      setCalLoaded(true);
    } catch {
      setCalByDate({});
      setCalLoaded(false);
    } finally {
      setCalLoading(false);
    }
  }, [calIsletmeId, calYear]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const goCalPrevMonth = () => {
    setCalMonth((m) => {
      if (m === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goCalNextMonth = () => {
    setCalMonth((m) => {
      if (m === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  const startYoreselPayment = async () => {
    if (!appUser?.id) {
      Alert.alert(tx('Üye girişi gerekli'), 'Ödeme için üye olmalısınız.');
      return;
    }
    setPaying(true);
    try {
      const res = await fetch(apiUrl('/api/payments/yoresel/init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: appUser.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.alreadyPaid) {
        await loadPaymentStatus();
        Alert.alert(tx('Ödeme'), 'Rezervasyon bedeli zaten ödendi. Talep gönderebilirsiniz.');
        return;
      }
      if (!res.ok) {
        Alert.alert(tx('Ödeme'), data.error || 'Ödeme başlatılamadı.');
        return;
      }
      if (data.checkoutUrl) {
        const opened = await Linking.openURL(data.checkoutUrl);
        if (opened === false) {
          Alert.alert(tx('Ödeme'), 'Kart sayfası açılamadı.');
        }
      }
    } catch {
      Alert.alert(tx('Hata'), 'Ödeme sayfasına bağlanılamadı.');
    } finally {
      setPaying(false);
    }
  };

  const eventDateLabel = tx(DATE_OPTIONS.find((o) => o.key === eventDate)?.label || eventDate);
  const eventTypeLabel = tx(EVENT_TYPES.find((e) => e.id === eventType)?.title || eventType);
  const calVenue = calIsletmeId ? isletmelerForCalendar.find((x) => x._id === calIsletmeId) : null;
  const timeSlotModalOptions = serviceTimeSlotModalKey
    ? slotOptionsForService(serviceTimeSlotModalKey)
    : YORESEL_TIME_SLOT_OPTIONS;
  const YEARS = [];
  const y0 = new Date().getFullYear();
  for (let y = y0 - 1; y <= y0 + 2; y += 1) YEARS.push(y);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{tx('Yöresel Etkinlikler')}</Text>
        <Text style={styles.subtitle}>
          {tx('Tarih ve etkinlik türünü seçin; ihtiyaç duyduğunuz hizmetleri işaretleyin. İsterseniz mekan / park-salon işletmesi seçerek talebinizi yönlendirin.')}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>{tx('Rezervasyon talebi')}</Text>

      <Text style={styles.label}>{tx('Etkinlik tarihi')}</Text>
      <TouchableOpacity style={styles.selectTouch} onPress={() => setDateModal(true)}>
        <Text style={styles.selectText}>{eventDateLabel}</Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{tx('Etkinlik türü')}</Text>
      <TouchableOpacity style={styles.selectTouch} onPress={() => setEventTypeModal(true)}>
        <Text style={styles.selectText}>{eventTypeLabel}</Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{tx('Hizmet alanları')}</Text>
      <Text style={styles.sectionHint}>{tx('Her seçtiğiniz hizmet için ayrı rezervasyon dilimi belirleyebilirsiniz.')}</Text>
      {SERVICE_OPTIONS.map((s) => (
        <View key={s.key} style={styles.serviceBlock}>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => toggleService(s.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, services[s.key] && styles.checkboxOn]}>
              {services[s.key] ? <Text style={styles.checkTick}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>{tx(s.label)}</Text>
          </TouchableOpacity>
          {services[s.key] ? (
            <>
              <Text style={styles.subLabel}>{tx('Rezervasyon dilimi')}</Text>
              <TouchableOpacity
                style={styles.selectTouch}
                onPress={() => setServiceTimeSlotModalKey(s.key)}
              >
                <Text style={styles.selectText}>{yoreselTimeSlotLabel(serviceTimeSlots[s.key])}</Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectTouch}
                onPress={() => {
                  setServicePickerKey(s.key);
                  setServiceIsletmeModal(true);
                }}
              >
                <Text style={styles.selectText} numberOfLines={2}>
                  {serviceTargets[s.key]
                    ? isletmelerForService(s.key).find((x) => x._id === serviceTargets[s.key])?.name || 'Seçili işletme'
                    : `${s.label} için işletme seç (isteğe bağlı)`}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ))}

      {appUser ? (
        <Text style={styles.loggedHint}>
          Giriş yaptınız: {[appUser.name, appUser.surname].filter(Boolean).join(' ') || appUser.username}
        </Text>
      ) : (
        <View style={styles.loginRequiredBox}>
          <Text style={styles.loginRequiredText}>{tx('Rezervasyon göndermek için üye girişi yapmalısınız.')}</Text>
          <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.navigate('UserLogin')} activeOpacity={0.8}>
            <Text style={styles.submitBtnText}>{tx('Giriş yap / Üye ol')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>{tx('Not (isteğe bağlı)')}</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder={tx('Özel istekleriniz')}
        placeholderTextColor="#999"
        multiline
      />

      {appUser && paymentRequired ? (
        <View style={[styles.paymentBox, paymentPaid ? styles.paymentBoxPaid : null]}>
          <Text style={styles.paymentTitle}>
            {paymentPaid ? 'Rezervasyon bedeli ödendi' : 'Rezervasyon bedeli'}
          </Text>
          <Text style={styles.paymentHint}>
            {paymentPaid
              ? 'Kart ödemeniz alındı. Talep gönder artık aktif.'
              : `Talep göndermek için uygulama sahibine ${paymentFee} TL kart ile ödemelisiniz.`}
          </Text>
          {!paymentPaid ? (
            <TouchableOpacity
              testID="yoresel-pay-button"
              style={[styles.payBtn, paying && styles.submitBtnDisabled]}
              onPress={startYoreselPayment}
              disabled={paying}
              activeOpacity={0.8}
            >
              {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Kart ile öde · {paymentFee} TL</Text>}
            </TouchableOpacity>
          ) : null}
          {!paymentPaid && !paymentConfigured && paymentStatusLoaded ? (
            <Text style={styles.paymentWarn}>{tx('Kart sistemi henüz bağlanmadı. Yönetici iyzico anahtarlarını eklemeli.')}</Text>
          ) : null}
        </View>
      ) : null}

      {appUser ? (
        <TouchableOpacity
          testID="yoresel-submit-button"
          style={[
            styles.submitBtn,
            (sending || (paymentRequired && !paymentPaid)) && styles.submitBtnDisabled,
          ]}
          onPress={submitTalep}
          disabled={sending || (paymentRequired && !paymentPaid)}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{tx('Talep gönder')}</Text>}
        </TouchableOpacity>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{tx('İşletme takvimi')}</Text>
      <Text style={styles.hint}>
        Hizmet alanı ve işletmeyi seçin; takvimde her gün için Gündüz / Akşam / Tam gün çubukları görünür (yeşil boş, turuncu
        bekleyen, kırmızı onaylı). Güne dokunarak etkinlik tarihini seçebilirsiniz.
      </Text>

      <Text style={styles.label}>{tx('Hizmet alanı (işletme listesini filtreler)')}</Text>
      <TouchableOpacity style={styles.selectTouch} onPress={() => setAlanModal(true)}>
        <Text style={styles.selectText}>{ALAN_OPTIONS.find((a) => a.id === calAlan)?.label || 'Tümü'}</Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{tx('İşletme')}</Text>
      <TouchableOpacity style={styles.selectTouch} onPress={() => setCalIsletmeModal(true)}>
        <Text style={styles.selectText} numberOfLines={2}>
          {calIsletmeId
            ? isletmelerForCalendar.find((x) => x._id === calIsletmeId)?.name || 'Seçili'
            : 'İşletme seçin'}
        </Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{tx('Yıl')}</Text>
      <TouchableOpacity style={styles.selectTouch} onPress={() => setYearModal(true)}>
        <Text style={styles.selectText}>{calYear}</Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.calendarLoadBtn, !calIsletmeId && styles.calendarLoadBtnDisabled]}
        onPress={fetchCalendar}
        disabled={calLoading || !calIsletmeId}
      >
        {calLoading ? <ActivityIndicator color="#1B4D4A" /> : <Text style={styles.calendarLoadText}>{tx('Takvimi yenile')}</Text>}
      </TouchableOpacity>

      {calVenue ? (
        <Text style={styles.hint}>
          Takvim: üst çizgi gündüz, alt çizgi akşam. İkisi kırmızıysa tam gün dolu.
          {Array.isArray(calVenue.offeredTimeSlots) && calVenue.offeredTimeSlots.length > 0
            ? ` Rezervasyon: ${calVenue.offeredTimeSlots.map((id) => yoreselTimeSlotLabel(id)).join(' · ')}.`
            : ''}
        </Text>
      ) : null}

      {calIsletmeId ? (
        <View style={styles.calVisualWrap}>
          {calLoading && !calLoaded ? (
            <ActivityIndicator style={styles.calSpinner} color="#1B4D4A" />
          ) : (
            <YoreselAvailabilityCalendar
              byDate={calByDate}
              year={calYear}
              monthIndex={calMonth}
              onPrevMonth={goCalPrevMonth}
              onNextMonth={goCalNextMonth}
              onSelectDay={(key) => setEventDate(key)}
              selectedDateKey={eventDate}
            />
          )}
        </View>
      ) : null}

      {calVenue && listingHasMedia(calVenue) ? (
        <View style={styles.venueMediaSection}>
          <Text style={styles.sectionTitle}>{tx('Fotoğraf ve dosyalar')}</Text>
          <Text style={styles.hint}>{tx('İşletmenin paylaştığı görsellere dokunarak sırayla gezinin.')}</Text>
          <ListingCardMedia
            item={calVenue}
            onOpenGallery={openGallery}
            imageWrapStyle={styles.venueMediaWrap}
            thumbStyle={styles.venueMediaThumb}
          />
        </View>
      ) : null}

      <Modal visible={dateModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDateModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tx('Tarih seçin')}</Text>
            <ScrollView style={styles.modalScroll}>
              {DATE_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={styles.modalItem}
                  onPress={() => {
                    setEventDate(o.key);
                    setDateModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{o.label} ({o.key})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDateModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!serviceTimeSlotModalKey} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setServiceTimeSlotModalKey('')}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {SERVICE_OPTIONS.find((s) => s.key === serviceTimeSlotModalKey)?.label || 'Hizmet'} — dilim
            </Text>
            <ScrollView style={styles.modalScroll}>
              {timeSlotModalOptions.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.modalItem}
                  onPress={() => {
                    const key = serviceTimeSlotModalKey;
                    setServiceTimeSlots((st) => ({ ...st, [key]: o.id }));
                    setServiceTimeSlotModalKey('');
                  }}
                >
                  <Text style={styles.modalItemText}>{tx(o.label)} ({o.range})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setServiceTimeSlotModalKey('')}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={eventTypeModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEventTypeModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tx('Etkinlik türü')}</Text>
            <ScrollView style={styles.modalScroll}>
              {EVENT_TYPES.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setEventType(e.id);
                    setEventTypeModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{e.emoji} {tx(e.title)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setEventTypeModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={serviceIsletmeModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setServiceIsletmeModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {(SERVICE_OPTIONS.find((s) => s.key === servicePickerKey)?.label || 'Hizmet')} işletmesi
            </Text>
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                if (servicePickerKey) {
                  setServiceTargets((prev) => ({ ...prev, [servicePickerKey]: '' }));
                }
                setServiceIsletmeModal(false);
              }}
            >
              <Text style={styles.modalItemText}>{tx('Seçme (genel talep)')}</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {loadingIsletmeler ? (
                <ActivityIndicator style={{ margin: 16 }} color="#1B4D4A" />
              ) : (
                isletmelerForService(servicePickerKey).map((it) => (
                  <TouchableOpacity
                    key={it._id}
                    style={styles.modalItem}
                    onPress={() => {
                      if (servicePickerKey) pickServiceIsletme(servicePickerKey, it._id);
                      setServiceIsletmeModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{it.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setServiceIsletmeModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={alanModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAlanModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Hizmet alanı</Text>
            <ScrollView style={styles.modalScroll}>
              {ALAN_OPTIONS.map((a) => (
                <TouchableOpacity
                  key={a.id || 'all'}
                  style={styles.modalItem}
                  onPress={() => {
                    setCalAlan(a.id);
                    setCalIsletmeId('');
                    setAlanModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setAlanModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={calIsletmeModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCalIsletmeModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tx('İşletme seçin')}</Text>
            <ScrollView style={styles.modalScroll}>
              {isletmelerForCalendar.length === 0 ? (
                <Text style={styles.emptyCal}>{tx('Bu alan için kayıtlı işletme yok.')}</Text>
              ) : (
                isletmelerForCalendar.map((it) => (
                  <TouchableOpacity
                    key={it._id}
                    style={styles.modalItem}
                    onPress={() => {
                      setCalIsletmeId(it._id);
                      setCalIsletmeModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{it.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setCalIsletmeModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={yearModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setYearModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tx('Yıl')}</Text>
            <ScrollView style={styles.modalScroll}>
              {YEARS.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={styles.modalItem}
                  onPress={() => {
                    setCalYear(y);
                    setYearModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setYearModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ListingMediaGalleryModal
        visible={galleryVisible}
        items={galleryItems}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#222' },
  subtitle: { marginTop: 8, fontSize: 14, color: '#666', lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginTop: 8, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  sectionHint: { fontSize: 12, color: '#777', marginBottom: 8, lineHeight: 17 },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 4 },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  selectText: { fontSize: 15, color: '#333', flex: 1, paddingRight: 8 },
  selectArrow: { fontSize: 12, color: '#666' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  serviceBlock: { marginBottom: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#1B4D4A', borderColor: '#1B4D4A' },
  checkTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkLabel: { fontSize: 15, color: '#333', flex: 1 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  loggedHint: { marginTop: 12, fontSize: 14, color: '#1B4D4A', fontWeight: '600' },
  loginRequiredBox: {
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E0A0',
  },
  loginRequiredText: { fontSize: 14, color: '#6D4C00', marginBottom: 12, fontWeight: '600' },
  paymentBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8EED6',
    borderWidth: 1,
    borderColor: '#E8D7A8',
  },
  paymentBoxPaid: {
    backgroundColor: '#E6F0EF',
    borderColor: '#C5D8D6',
  },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 },
  paymentHint: { fontSize: 13, color: '#5C5346', lineHeight: 18, marginBottom: 10 },
  paymentWarn: { marginTop: 8, fontSize: 12, color: '#B42318', lineHeight: 17 },
  payBtn: {
    backgroundColor: '#1B4D4A',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: '#1B4D4A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 28 },
  hint: { fontSize: 13, color: '#666', lineHeight: 19, marginBottom: 8 },
  calendarLoadBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1B4D4A',
    alignItems: 'center',
  },
  calendarLoadBtnDisabled: { opacity: 0.45 },
  calendarLoadText: { color: '#1B4D4A', fontSize: 15, fontWeight: '700' },
  emptyCal: { fontSize: 14, color: '#888', fontStyle: 'italic', marginTop: 12, paddingHorizontal: 4 },
  calVisualWrap: { marginTop: 14 },
  calSpinner: { marginVertical: 24 },
  venueMediaSection: { marginTop: 20, marginBottom: 8 },
  venueMediaWrap: { alignSelf: 'flex-start' },
  venueMediaThumb: { width: 120, height: 120, borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalScroll: { maxHeight: 360 },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#1B4D4A' },
});
