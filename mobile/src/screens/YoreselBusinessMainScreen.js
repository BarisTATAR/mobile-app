import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import YoreselAvailabilityCalendar from '../components/YoreselAvailabilityCalendar';
import PremiumListingsPanel from '../components/PremiumListingsPanel';
import { YORESEL_TIME_SLOT_OPTIONS, yoreselTimeSlotLabel } from '../constants/yoreselTimeSlots';
import { DEFAULT_CITY } from '../services/turkeyAddressService';

const YORESEL_SESSION_KEY = 'yoreselBusinessSession';
const TALEP_STATUS_LABELS = {
  pending: 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
  partial: 'Kısmen',
};

function yoreselDurumBuIsletme(talep, isletmeId) {
  const sid = String(isletmeId);
  const rows = talep.isletmeStatuses;
  if (Array.isArray(rows) && rows.length > 0) {
    const row = rows.find((x) => String(x.isletme) === sid);
    if (row && row.status) return row.status;
  }
  if (talep.status === 'cancelled') return 'rejected';
  if (talep.status === 'approved') return 'approved';
  if (talep.status === 'rejected') return 'rejected';
  return 'pending';
}

const EVENT_TYPES = [
  { id: 'dugun', label: 'Düğün' },
  { id: 'nisan', label: 'Nişan' },
  { id: 'kina', label: 'Kına' },
  { id: 'sunnet', label: 'Sünnet' },
  { id: 'bekarliga_veda', label: 'Bekarlığa veda' },
  { id: 'asker_eglencesi', label: 'Asker eğlencesi' },
  { id: 'dogum_gunu', label: 'Doğum günü' },
];

/** Bu işletmenin talepte üstlendiği hizmet satırları (ör. Park / salon) */
const SERVICE_ROLE_LABELS = {
  muzisyen: 'Müzisyen',
  asci: 'Aşçı',
  susleme: 'Süsleme / organizasyon',
  zurna: 'Zurna ekibi',
  parkSalon: 'Park / salon',
  mekan: 'Mekan',
  kuafor: 'Kuaför',
  aracKiralama: 'Araç kiralama',
};

function eventTypeLabel(eventType) {
  const id = eventType != null ? String(eventType) : '';
  return EVENT_TYPES.find((e) => e.id === id)?.label || id || '—';
}

function serviceRolesForVenue(talep, isletmeId) {
  const sid = String(isletmeId);
  const st = talep.serviceTargets || {};
  const sts = talep.serviceTimeSlots || {};
  const out = [];
  Object.keys(SERVICE_ROLE_LABELS).forEach((key) => {
    const tid = st[key];
    if (tid != null && String(tid) === sid) {
      const slot = sts[key] || talep.timeSlot;
      const slotLabel = yoreselTimeSlotLabel(slot);
      out.push(`${SERVICE_ROLE_LABELS[key]} (${slotLabel})`);
    }
  });
  if (out.length === 0 && talep.targetIsletme != null && String(talep.targetIsletme) === sid) {
    out.push(`Seçili mekân (${yoreselTimeSlotLabel(talep.timeSlot)})`);
  }
  return out;
}

function dilimLineForTalep(item) {
  if (item.effectiveTimeSlotLabel) return item.effectiveTimeSlotLabel;
  if (Array.isArray(item.serviceSlotLines) && item.serviceSlotLines.length > 0) {
    return item.serviceSlotLines.map((l) => `${l.label}: ${l.timeSlotLabel}`).join(' · ');
  }
  return yoreselTimeSlotLabel(item.timeSlot);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(str) {
  if (!str || typeof str !== 'string') return new Date();
  const trimmed = str.trim();
  if (!trimmed) return new Date();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
}

function formatDateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateNotBeforeToday(date) {
  const t = startOfToday();
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  return x < t ? new Date(t) : date;
}

function errorIfLicenseExpiryBeforeToday(licenseExpiryStr) {
  const s = (licenseExpiryStr != null ? String(licenseExpiryStr) : '').trim();
  if (!s) return null;
  const part = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    return 'Lisans bitiş süresi YYYY-AA-GG formatında olmalıdır.';
  }
  const t = startOfToday();
  const [y, mo, da] = part.split('-').map((n) => parseInt(n, 10));
  const chosen = new Date(y, mo - 1, da);
  chosen.setHours(0, 0, 0, 0);
  if (chosen < t) return 'Lisans bitiş süresi bugünden önce olamaz.';
  return null;
}

function resolveDuyuruImageUri(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return apiUrl(s.startsWith('/') ? s : `/${s}`);
}

function emptyDuyuruForm(registeredDistrict) {
  return {
    title: '',
    description: '',
    addressCity: DEFAULT_CITY,
    addressDistrict: registeredDistrict ? String(registeredDistrict).trim() : '',
    addressNeighborhood: '',
    startDate: '',
    endDate: '',
    licenseExpiry: '',
    imageUrl: '',
    active: true,
  };
}

async function persistYoreselSession(loginName, isletmeler, selectedIsletmeId, multiVenueLogin, premium) {
  await AsyncStorage.setItem(
    YORESEL_SESSION_KEY,
    JSON.stringify({
      loginName: loginName || '',
      isletmeler,
      selectedIsletmeId,
      multiVenueLogin: multiVenueLogin === true,
      premium: premium === true,
    })
  );
}

export default function YoreselBusinessMainScreen({ route, navigation }) {
  const {
    isletmeler: routeIsletmeler = [],
    selectedIsletmeId: routeSelectedId,
    loginName: routeLoginName = '',
    multiVenueLogin: routeMultiVenueLogin,
    premium: routePremium,
  } = route.params || {};

  const [isletmeler, setIsletmeler] = useState(() => (Array.isArray(routeIsletmeler) ? routeIsletmeler : []));
  const [selectedId, setSelectedId] = useState(() => {
    if (routeSelectedId) return routeSelectedId;
    const first = routeIsletmeler && routeIsletmeler[0];
    return first ? first.id : '';
  });
  const [loginName, setLoginName] = useState(routeLoginName || '');
  const [premium, setPremium] = useState(routePremium === true);
  const [mahalleFilter, setMahalleFilter] = useState('');

  const [tab, setTab] = useState('pending');
  const [panelMode, setPanelMode] = useState('rezervasyon');
  const [date, setDate] = useState(todayStr());
  const [pending, setPending] = useState([]);
  const [list, setList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [manualModal, setManualModal] = useState(false);
  const [manual, setManual] = useState({
    date: todayStr(),
    eventType: 'dugun',
    timeSlot: 'gunduz',
    guestName: '',
    guestPhone: '',
    note: '',
  });

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calByDate, setCalByDate] = useState({});
  const [calOfferedSlots, setCalOfferedSlots] = useState(['gunduz', 'aksam', 'tam_gun']);
  const [calLoading, setCalLoading] = useState(false);
  const [calLoaded, setCalLoaded] = useState(false);
  const [dayDetailModal, setDayDetailModal] = useState(false);
  const [dateFetching, setDateFetching] = useState(false);

  const [duyurular, setDuyurular] = useState([]);
  const [duyuruModal, setDuyuruModal] = useState(false);
  const [duyuruSaving, setDuyuruSaving] = useState(false);
  const [duyuruImageUploading, setDuyuruImageUploading] = useState(false);
  const [duyuruDatePickerField, setDuyuruDatePickerField] = useState(null);
  const [duyuruDatePickerTemp, setDuyuruDatePickerTemp] = useState(new Date());
  const [editingDuyuruId, setEditingDuyuruId] = useState('');
  const [duyuruForm, setDuyuruForm] = useState(() => emptyDuyuruForm(null));

  const selectedVenue = isletmeler.find((x) => x.id === selectedId) || isletmeler[0];

  const registeredDistrict = useMemo(() => {
    for (const v of isletmeler) {
      const d = v?.district != null ? String(v.district).trim() : '';
      if (d) return d;
    }
    return '';
  }, [isletmeler]);

  const duyuruAuthIsletmeId = isletmeler[0]?.id || selectedId;
  const premiumAuthIsletmeId = isletmeler[0]?.id || selectedId;

  const multiVenueLogin = useMemo(() => {
    if (routeMultiVenueLogin === true) return true;
    if (routeMultiVenueLogin === false) return false;
    return isletmeler.length > 1;
  }, [routeMultiVenueLogin, isletmeler.length]);

  const neighborhoodOptions = useMemo(() => {
    const set = new Set();
    isletmeler.forEach((v) => {
      const n = (v.neighborhood != null ? String(v.neighborhood) : '').trim();
      if (n) set.add(n);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [isletmeler]);

  const filteredVenues = useMemo(() => {
    if (!multiVenueLogin || !mahalleFilter) return isletmeler;
    return isletmeler.filter(
      (v) => (v.neighborhood != null ? String(v.neighborhood).trim() : '') === mahalleFilter
    );
  }, [isletmeler, mahalleFilter, multiVenueLogin]);

  useEffect(() => {
    if (!multiVenueLogin && mahalleFilter) setMahalleFilter('');
  }, [multiVenueLogin, mahalleFilter]);

  useEffect(() => {
    setIsletmeler(Array.isArray(routeIsletmeler) ? routeIsletmeler : []);
    if (routeSelectedId) setSelectedId(routeSelectedId);
    else if (routeIsletmeler && routeIsletmeler[0]) setSelectedId(routeIsletmeler[0].id);
    if (routeLoginName) setLoginName(routeLoginName);
    if (routePremium === true) setPremium(true);
  }, [routeIsletmeler, routeSelectedId, routeLoginName, routePremium]);

  useEffect(() => {
    if (!filteredVenues.length) return;
    if (!filteredVenues.some((v) => v.id === selectedId)) {
      const nextId = filteredVenues[0].id;
      setSelectedId(nextId);
      persistYoreselSession(loginName, isletmeler, nextId, multiVenueLogin, premium);
    }
  }, [filteredVenues, selectedId, loginName, isletmeler, multiVenueLogin, premium]);

  const fetchPending = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(apiUrl(`/api/yoresel-isletme/${selectedId}/talepler/pending`));
      const data = await res.json().catch(() => ({}));
      setPending(res.ok ? (data.talepler || []) : []);
    } catch (e) {
      setPending([]);
    }
  }, [selectedId]);

  const fetchByDate = useCallback(async () => {
    if (!selectedId) return;
    setDateFetching(true);
    try {
      const res = await fetch(apiUrl(`/api/yoresel-isletme/${selectedId}/talepler?date=${encodeURIComponent(date)}`));
      const data = await res.json().catch(() => ({}));
      setList(res.ok ? (data.talepler || []) : []);
    } catch (e) {
      setList([]);
    } finally {
      setDateFetching(false);
    }
  }, [selectedId, date]);

  const fetchDuyurular = useCallback(async () => {
    if (!duyuruAuthIsletmeId || !loginName) {
      setDuyurular([]);
      return;
    }
    try {
      const q = `loginName=${encodeURIComponent(loginName)}`;
      const res = await fetch(apiUrl(`/api/yoresel-isletme/${duyuruAuthIsletmeId}/duyurular?${q}`));
      const data = await res.json().catch(() => ({}));
      setDuyurular(res.ok && Array.isArray(data.list) ? data.list : []);
    } catch (e) {
      setDuyurular([]);
    }
  }, [duyuruAuthIsletmeId, loginName]);

  const fetchCalendar = useCallback(async () => {
    if (!selectedId) {
      setCalByDate({});
      setCalLoaded(false);
      return;
    }
    setCalLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/yoresel-etkinlik/isletmeler/${selectedId}/takvim?year=${calYear}`)
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
    } catch (e) {
      setCalByDate({});
      setCalLoaded(false);
    } finally {
      setCalLoading(false);
    }
  }, [selectedId, calYear]);

  useEffect(() => {
    setDayDetailModal(false);
  }, [selectedId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    fetchByDate();
  }, [fetchByDate]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    if (panelMode === 'duyurular') fetchDuyurular();
  }, [panelMode, fetchDuyurular]);

  const selectVenue = async (id) => {
    setSelectedId(id);
    await persistYoreselSession(loginName, isletmeler, id, multiVenueLogin, premium);
  };

  const refresh = async () => {
    setRefreshing(true);
    if (panelMode === 'duyurular') {
      await fetchDuyurular();
    } else {
      await Promise.all([fetchPending(), fetchByDate(), fetchCalendar()]);
    }
    setRefreshing(false);
  };

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

  const setStatus = async (talepId, status) => {
    try {
      const res = await fetch(apiUrl(`/api/yoresel-isletme/${selectedId}/talepler/${talepId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Hata', data.error || 'İşlem yapılamadı');
        return;
      }
      await refresh();
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const openDuyuruModal = (item) => {
    setDuyuruDatePickerField(null);
    if (item) {
      setEditingDuyuruId(item._id);
      const addr = item.address || {};
      setDuyuruForm({
        title: item.title || '',
        description: item.description || '',
        addressCity: addr.city ? String(addr.city).trim() : DEFAULT_CITY,
        addressDistrict: addr.district ? String(addr.district).trim() : registeredDistrict,
        addressNeighborhood: addr.neighborhood ? String(addr.neighborhood).trim() : '',
        startDate: item.startDate || '',
        endDate: item.endDate || '',
        licenseExpiry: item.licenseExpiry || '',
        imageUrl: item.imageUrl || '',
        active: item.active !== false,
      });
    } else {
      setEditingDuyuruId('');
      setDuyuruForm(emptyDuyuruForm(registeredDistrict));
    }
    setDuyuruModal(true);
  };

  const pickDuyuruImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin', 'Galeri erişimi gerekli.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setDuyuruImageUploading(true);
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('image', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      const res = await fetch(apiUrl('/api/upload/image'), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setDuyuruForm((p) => ({ ...p, imageUrl: data.url }));
      } else {
        Alert.alert('Hata', data.error || 'Yükleme başarısız.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setDuyuruImageUploading(false);
    }
  };

  const applyDuyuruDatePicker = (field, date) => {
    let next = date;
    if (field === 'licenseExpiry') next = dateNotBeforeToday(next);
    setDuyuruForm((p) => ({ ...p, [field]: formatDateToStr(next) }));
    setDuyuruDatePickerField(null);
  };

  const saveDuyuru = async () => {
    if (!duyuruForm.title.trim()) {
      Alert.alert('Uyarı', 'Başlık zorunlu.');
      return;
    }
    const licErr = errorIfLicenseExpiryBeforeToday(duyuruForm.licenseExpiry);
    if (licErr) {
      Alert.alert('Geçersiz tarih', licErr);
      return;
    }
    setDuyuruSaving(true);
    try {
      const body = {
        loginName,
        title: duyuruForm.title.trim(),
        description: duyuruForm.description.trim(),
        addressCity: (duyuruForm.addressCity || DEFAULT_CITY).trim(),
        addressDistrict: (duyuruForm.addressDistrict || registeredDistrict).trim(),
        addressNeighborhood: duyuruForm.addressNeighborhood.trim(),
        startDate: duyuruForm.startDate.trim(),
        endDate: duyuruForm.endDate.trim(),
        licenseExpiry: duyuruForm.licenseExpiry.trim(),
        imageUrl: duyuruForm.imageUrl.trim(),
        active: duyuruForm.active !== false,
      };
      const url = editingDuyuruId
        ? apiUrl(`/api/yoresel-isletme/${duyuruAuthIsletmeId}/duyurular/${editingDuyuruId}`)
        : apiUrl(`/api/yoresel-isletme/${duyuruAuthIsletmeId}/duyurular`);
      const res = await fetch(url, {
        method: editingDuyuruId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Hata', data.error || 'Kaydedilemedi');
        return;
      }
      setDuyuruModal(false);
      setDuyuruDatePickerField(null);
      setEditingDuyuruId('');
      setDuyuruForm(emptyDuyuruForm(registeredDistrict));
      await fetchDuyurular();
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setDuyuruSaving(false);
    }
  };

  const deleteDuyuru = (item) => {
    const title = String(item?.title || 'Duyuru').trim();
    Alert.alert(
      'Duyuruyu çıkar',
      `"${title}" silinsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              const q = `loginName=${encodeURIComponent(loginName)}`;
              const res = await fetch(
                apiUrl(`/api/yoresel-isletme/${duyuruAuthIsletmeId}/duyurular/${item._id}?${q}`),
                { method: 'DELETE' }
              );
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                Alert.alert('Hata', data.error || 'Silinemedi');
                return;
              }
              await fetchDuyurular();
            } catch (e) {
              Alert.alert('Hata', 'Bağlantı hatası');
            }
          },
        },
      ]
    );
  };

  const saveManual = async () => {
    if (!manual.date || !manual.guestName.trim() || !manual.guestPhone.trim()) {
      Alert.alert('Uyarı', 'Tarih, isim ve telefon zorunlu.');
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/yoresel-isletme/${selectedId}/talepler/manual`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: manual.date.trim(),
          eventType: manual.eventType,
          timeSlot: manual.timeSlot,
          guestName: manual.guestName.trim(),
          guestPhone: manual.guestPhone.replace(/[^\d]/g, ''),
          note: manual.note.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Hata', data.error || 'Kayıt eklenemedi');
        return;
      }
      setManualModal(false);
      setManual({ date: todayStr(), eventType: 'dugun', timeSlot: 'gunduz', guestName: '', guestPhone: '', note: '' });
      await refresh();
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const renderTalepBody = (item, { showActionButtons }) => {
    const nameText = item.user
      ? `${item.user.name || ''} ${item.user.surname || ''}`.trim() || 'Kullanıcı'
      : item.guestName || 'Misafir';
    const phoneText = item.guestPhone || item.user?.phone || '—';
    const myStatus = yoreselDurumBuIsletme(item, selectedId);
    const myStatusLabel = TALEP_STATUS_LABELS[myStatus] || myStatus;
    const showActions = showActionButtons && myStatus === 'pending';
    const roles = serviceRolesForVenue(item, selectedId);
    const rolesLine = roles.length > 0 ? roles.join(' · ') : '—';
    return (
      <>
        <Text style={styles.rowTitle}>{item.date} · {eventTypeLabel(item.eventType)}</Text>
        <Text style={styles.rowSub}>Dilim: {dilimLineForTalep(item)}</Text>
        <Text style={styles.rowSub}>Rezervasyon sahibi: {nameText}</Text>
        <Text style={styles.rowSub}>Cep telefonu: {phoneText}</Text>
        <Text style={styles.rowSub}>Bu mekân için rol: {rolesLine}</Text>
        <Text style={styles.rowSub}>Bu mekân için durum: {myStatusLabel}</Text>
        {item.status === 'partial' ? (
          <Text style={styles.rowSubMuted}>Talep geneli: işletmeler ayrı ayrı yanıtlıyor</Text>
        ) : null}
        {item.manualEntry ? <Text style={styles.manualBadge}>Manuel kayıt</Text> : null}
        {String(item.note || '').trim() ? <Text style={styles.rowSub}>Not: {String(item.note).trim()}</Text> : null}
        {showActions ? (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.approve]} onPress={() => setStatus(item._id, 'approved')}>
              <Text style={styles.actionText}>Onayla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.reject]} onPress={() => setStatus(item._id, 'rejected')}>
              <Text style={styles.actionText}>Reddet</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    );
  };

  const renderTalep = ({ item, pendingMode }) => (
    <View style={styles.card}>{renderTalepBody(item, { showActionButtons: pendingMode })}</View>
  );

  const venuePickerBlock = (
    <>
      {multiVenueLogin && neighborhoodOptions.length > 0 ? (
        <View style={styles.mahalleStrip}>
          <Text style={styles.mahalleStripLabel}>Mahalle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.venueChips}>
            <TouchableOpacity
              style={[styles.mahalleChip, !mahalleFilter && styles.mahalleChipActive]}
              onPress={() => setMahalleFilter('')}
            >
              <Text style={[styles.mahalleChipText, !mahalleFilter && styles.mahalleChipTextActive]}>Tümü</Text>
            </TouchableOpacity>
            {neighborhoodOptions.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.mahalleChip, mahalleFilter === m && styles.mahalleChipActive]}
                onPress={() => setMahalleFilter(m)}
              >
                <Text style={[styles.mahalleChipText, mahalleFilter === m && styles.mahalleChipTextActive]} numberOfLines={1}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {isletmeler.length > 1 ? (
        <View style={styles.venueStrip}>
          <Text style={styles.venueStripLabel}>Mekan seçin</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.venueChips}>
            {filteredVenues.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.venueChip, selectedId === v.id && styles.venueChipActive]}
                onPress={() => selectVenue(v.id)}
              >
                <Text style={[styles.venueChipText, selectedId === v.id && styles.venueChipTextActive]} numberOfLines={1}>
                  {v.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );

  const listHeader = (
    <View>
      {venuePickerBlock}

      <TouchableOpacity style={styles.manualBtn} onPress={() => setManualModal(true)}>
        <Text style={styles.manualBtnText}>Manuel rezervasyon ekle</Text>
      </TouchableOpacity>

      <Text style={styles.calHint}>
        Her günde 2 çizgi: üst gündüz, alt akşam (yeşil boş, turuncu bekleyen, kırmızı dolu). İkisi de kırmızıysa tam gün dolu. Güne dokunarak o günü listelersiniz.
      </Text>
      {selectedVenue?.offeredTimeSlots?.length ? (
        <Text style={styles.calHint}>
          Sunduğunuz dilimler: {(selectedVenue.offeredTimeSlots || []).map((id) => yoreselTimeSlotLabel(id)).join(' · ')}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.refreshCalBtn} onPress={fetchCalendar} disabled={calLoading}>
        {calLoading ? <ActivityIndicator color="#34C759" /> : <Text style={styles.refreshCalText}>Takvimi yenile</Text>}
      </TouchableOpacity>

      {selectedId && calLoading && !calLoaded ? (
        <ActivityIndicator style={styles.calSpinner} color="#34C759" />
      ) : selectedId ? (
        <View style={styles.calWrap}>
          <YoreselAvailabilityCalendar
            byDate={calByDate}
            year={calYear}
            monthIndex={calMonth}
            onPrevMonth={goCalPrevMonth}
            onNextMonth={goCalNextMonth}
            onSelectDay={(key) => {
              setDate(key);
              setTab('date');
              setDayDetailModal(true);
            }}
            selectedDateKey={date}
          />
        </View>
      ) : null}

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>Bekleyen ({pending.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'date' && styles.tabActive]} onPress={() => setTab('date')}>
          <Text style={[styles.tabText, tab === 'date' && styles.tabTextActive]}>Tarih listesi</Text>
        </TouchableOpacity>
      </View>

      {tab === 'date' ? (
        <Text style={styles.selectedDateLine}>Seçili gün: {date}</Text>
      ) : null}
    </View>
  );

  const flatData = tab === 'pending' ? pending : list;

  const duyuruHeader = (
    <View>
      <Text style={styles.duyuruHint}>
        Duyurular işletme hesabınıza bağlıdır; belirli bir mekâna bağlı değildir.
        {registeredDistrict ? ` Kayıtlı ilçe: ${registeredDistrict}` : ''}
      </Text>
      <TouchableOpacity style={styles.manualBtn} onPress={() => openDuyuruModal(null)}>
        <Text style={styles.manualBtnText}>Yeni duyuru paylaş</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDuyuru = ({ item }) => {
    const imgUri = resolveDuyuruImageUri(item.imageUrl);
    const addrParts = [
      item.address?.city,
      item.address?.district,
      item.address?.neighborhood,
    ].filter(Boolean);
    return (
      <View style={styles.card}>
        <View style={styles.duyuruCardRow}>
          <View style={styles.duyuruCardText}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.description ? <Text style={styles.rowSub}>{item.description}</Text> : null}
            {(item.startDate || item.endDate) ? (
              <Text style={styles.rowSub}>
                Tarih: {[item.startDate, item.endDate].filter(Boolean).join(' – ')}
              </Text>
            ) : null}
            {item.licenseExpiry ? (
              <Text style={styles.rowSubMuted}>Lisans bitiş: {item.licenseExpiry}</Text>
            ) : null}
            {addrParts.length > 0 ? (
              <Text style={styles.rowSubMuted}>{addrParts.join(', ')}</Text>
            ) : null}
            <Text style={styles.rowSub}>
              Durum: {item.active !== false ? 'Yayında' : 'Pasif'}
            </Text>
            <View style={styles.duyuruActions}>
              <TouchableOpacity style={styles.duyuruEditBtn} onPress={() => openDuyuruModal(item)}>
                <Text style={styles.duyuruEditBtnText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.duyuruDeleteBtn} onPress={() => deleteDuyuru(item)}>
                <Text style={styles.duyuruDeleteBtnText}>Çıkar</Text>
              </TouchableOpacity>
            </View>
          </View>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.duyuruThumb} resizeMode="cover" />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {selectedVenue?.name || 'Yöresel İşletme'}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.removeItem(YORESEL_SESSION_KEY);
            navigation.replace('Login');
          }}
        >
          <Text style={styles.logout}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panelTabs}>
        <TouchableOpacity
          style={[styles.panelTab, panelMode === 'rezervasyon' && styles.panelTabActive]}
          onPress={() => setPanelMode('rezervasyon')}
        >
          <Text style={[styles.panelTabText, panelMode === 'rezervasyon' && styles.panelTabTextActive]}>Rezervasyonlar</Text>
        </TouchableOpacity>
        {multiVenueLogin ? (
          <TouchableOpacity
            style={[styles.panelTab, panelMode === 'duyurular' && styles.panelTabActive]}
            onPress={() => setPanelMode('duyurular')}
          >
            <Text style={[styles.panelTabText, panelMode === 'duyurular' && styles.panelTabTextActive]}>Duyurular</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.panelTab, panelMode === 'premium' && styles.panelTabActive]}
            onPress={() => setPanelMode('premium')}
          >
            <Text style={[styles.panelTabText, panelMode === 'premium' && styles.panelTabTextActive]}>Kampanya/İndirim</Text>
          </TouchableOpacity>
        )}
      </View>

      {panelMode === 'rezervasyon' ? (
      <FlatList
        data={flatData}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />}
        ListEmptyComponent={
          !refreshing && flatData.length === 0 ? (
            <Text style={styles.empty}>{tab === 'pending' ? 'Bekleyen onay yok.' : 'Bu tarihte kayıt yok.'}</Text>
          ) : null
        }
        renderItem={({ item }) => renderTalep({ item, pendingMode: tab === 'pending' })}
        contentContainerStyle={styles.listContent}
      />
      ) : panelMode === 'duyurular' ? (
      <FlatList
        data={duyurular}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={duyuruHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />}
        ListEmptyComponent={
          !refreshing && duyurular.length === 0 ? (
            <Text style={styles.empty}>Henüz duyuru yok. Yeni duyuru paylaşabilirsiniz.</Text>
          ) : null
        }
        renderItem={renderDuyuru}
        contentContainerStyle={styles.listContent}
      />
      ) : (
      <PremiumListingsPanel
        ownerType="yoresel_etkinlik"
        ownerId={premiumAuthIsletmeId}
        loginKey={loginName || selectedVenue?.name || ''}
        displayName={loginName || selectedVenue?.name || ''}
        registeredDistrict={registeredDistrict}
      />
      )}

      <Modal visible={dayDetailModal} transparent animationType="fade" onRequestClose={() => setDayDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.dayDetailModalBox]}>
            <Text style={styles.modalTitle}>Takvim — {date}</Text>
            <Text style={styles.dayDetailHint}>Etkinlik türü, bu mekânın rolü, iletişim ve not bilgileri</Text>
            {dateFetching ? (
              <ActivityIndicator style={styles.dayDetailSpinner} color="#34C759" />
            ) : list.length === 0 ? (
              <Text style={styles.dayDetailEmpty}>Bu tarihte kayıt yok.</Text>
            ) : (
              <ScrollView style={styles.dayDetailScroll} keyboardShouldPersistTaps="handled">
                {list.map((t) => (
                  <View key={t._id} style={styles.dayDetailCard}>
                    {renderTalepBody(t, { showActionButtons: true })}
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.dayDetailCloseBtn} onPress={() => setDayDetailModal(false)}>
              <Text style={styles.dayDetailCloseBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={manualModal} transparent animationType="fade" onRequestClose={() => setManualModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Manuel rezervasyon</Text>
            <TextInput style={styles.input} value={manual.date} onChangeText={(v) => setManual((p) => ({ ...p, date: v }))} placeholder="YYYY-AA-GG" />
            <Text style={styles.manualSlotLabel}>Rezervasyon dilimi</Text>
            <View style={styles.eventWrap}>
              {YORESEL_TIME_SLOT_OPTIONS.filter((o) => {
                const offered = selectedVenue?.offeredTimeSlots || calOfferedSlots;
                return !offered?.length || offered.includes(o.id);
              }).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.eventChip, manual.timeSlot === o.id && styles.eventChipActive]}
                  onPress={() => setManual((p) => ({ ...p, timeSlot: o.id }))}
                >
                  <Text style={[styles.eventChipText, manual.timeSlot === o.id && styles.eventChipTextActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={manual.guestName} onChangeText={(v) => setManual((p) => ({ ...p, guestName: v }))} placeholder="İsim Soyisim" />
            <TextInput style={styles.input} value={manual.guestPhone} onChangeText={(v) => setManual((p) => ({ ...p, guestPhone: v.replace(/[^\d]/g, '') }))} placeholder="Telefon" keyboardType="number-pad" />
            <View style={styles.eventWrap}>
              {EVENT_TYPES.map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.eventChip, manual.eventType === ev.id && styles.eventChipActive]}
                  onPress={() => setManual((p) => ({ ...p, eventType: ev.id }))}
                >
                  <Text style={[styles.eventChipText, manual.eventType === ev.id && styles.eventChipTextActive]}>{ev.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, styles.note]} value={manual.note} onChangeText={(v) => setManual((p) => ({ ...p, note: v }))} placeholder="Not (opsiyonel)" multiline />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setManualModal(false)}><Text>İptal</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveManual}><Text style={{ color: '#fff' }}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={duyuruModal} transparent animationType="fade" onRequestClose={() => { setDuyuruModal(false); setDuyuruDatePickerField(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.duyuruModalBox]}>
            <Text style={styles.modalTitle}>{editingDuyuruId ? 'Duyuruyu düzenle' : 'Yeni duyuru'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
              <TextInput
                style={styles.input}
                value={duyuruForm.title}
                onChangeText={(v) => setDuyuruForm((p) => ({ ...p, title: v }))}
                placeholder="Başlık *"
              />
              <TextInput
                style={[styles.input, styles.note]}
                value={duyuruForm.description}
                onChangeText={(v) => setDuyuruForm((p) => ({ ...p, description: v }))}
                placeholder="Açıklama"
                multiline
              />
              <Text style={styles.duyuruFieldLabel}>İlçe (kayıtlı)</Text>
              <TextInput
                style={styles.input}
                value={duyuruForm.addressDistrict}
                onChangeText={(v) => setDuyuruForm((p) => ({ ...p, addressDistrict: v }))}
                placeholder={registeredDistrict || 'İlçe'}
              />
              <Text style={styles.duyuruFieldLabel}>Mahalle</Text>
              <TextInput
                style={styles.input}
                value={duyuruForm.addressNeighborhood}
                onChangeText={(v) => setDuyuruForm((p) => ({ ...p, addressNeighborhood: v }))}
                placeholder="Mahalle"
              />
              {['startDate', 'endDate', 'licenseExpiry'].map((field) => {
                const labels = {
                  startDate: 'Başlangıç tarihi',
                  endDate: 'Bitiş tarihi',
                  licenseExpiry: 'Lisans bitiş süresi',
                };
                const dateStr = duyuruForm[field] || '';
                return (
                  <View key={field}>
                    <Text style={styles.duyuruFieldLabel}>{labels[field]}</Text>
                    <TouchableOpacity
                      style={styles.dateTouch}
                      onPress={() => {
                        let base = parseDateStr(dateStr);
                        if (field === 'licenseExpiry') base = dateNotBeforeToday(base);
                        setDuyuruDatePickerTemp(base);
                        setDuyuruDatePickerField(field);
                      }}
                    >
                      <Text style={[styles.dateTouchText, !dateStr && styles.dateTouchPlaceholder]}>
                        {dateStr || 'Tarih seçin'}
                      </Text>
                      <Text style={styles.dateTouchIcon}>📅</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {duyuruDatePickerField ? (
                Platform.OS === 'ios' ? (
                  <View style={styles.datePickerIosWrap}>
                    <DateTimePicker
                      value={duyuruDatePickerTemp}
                      mode="date"
                      display="spinner"
                      minimumDate={duyuruDatePickerField === 'licenseExpiry' ? startOfToday() : undefined}
                      onChange={(_, selected) => {
                        if (selected) setDuyuruDatePickerTemp(selected);
                      }}
                    />
                    <View style={styles.datePickerIosActions}>
                      <TouchableOpacity onPress={() => setDuyuruDatePickerField(null)}>
                        <Text>İptal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => applyDuyuruDatePicker(duyuruDatePickerField, duyuruDatePickerTemp)}
                      >
                        <Text style={styles.datePickerIosOk}>Tamam</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <DateTimePicker
                    value={duyuruDatePickerTemp}
                    mode="date"
                    minimumDate={duyuruDatePickerField === 'licenseExpiry' ? startOfToday() : undefined}
                    onChange={(event, selected) => {
                      if (event.type === 'dismissed' || !selected) {
                        setDuyuruDatePickerField(null);
                        return;
                      }
                      applyDuyuruDatePicker(duyuruDatePickerField, selected);
                    }}
                  />
                )
              ) : null}
              <Text style={styles.duyuruFieldLabel}>Fotoğraf</Text>
              {duyuruForm.imageUrl ? (
                <Image
                  source={{ uri: resolveDuyuruImageUri(duyuruForm.imageUrl) }}
                  style={styles.duyuruFormThumb}
                  resizeMode="cover"
                />
              ) : null}
              <TextInput
                style={styles.input}
                value={duyuruForm.imageUrl}
                onChangeText={(v) => setDuyuruForm((p) => ({ ...p, imageUrl: v }))}
                placeholder="Fotoğraf URL (yükle veya yapıştır)"
              />
              <TouchableOpacity
                style={[styles.uploadImageBtn, duyuruImageUploading && styles.uploadImageBtnDisabled]}
                onPress={pickDuyuruImage}
                disabled={duyuruImageUploading}
              >
                {duyuruImageUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.uploadImageBtnText}>Galeriden fotoğraf seç & yükle</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.activeToggle}
                onPress={() => setDuyuruForm((p) => ({ ...p, active: !p.active }))}
              >
                <Text style={styles.activeToggleText}>
                  Yayında: {duyuruForm.active !== false ? 'Evet' : 'Hayır'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setDuyuruModal(false); setDuyuruDatePickerField(null); }}
                disabled={duyuruSaving}
              >
                <Text>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveDuyuru} disabled={duyuruSaving}>
                {duyuruSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#34C759', paddingTop: 46, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 17, flex: 1, paddingRight: 8 },
  logout: { color: '#fff', fontWeight: '700' },
  panelTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6e6e6' },
  panelTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  panelTabActive: { borderBottomWidth: 2, borderBottomColor: '#34C759' },
  panelTabText: { color: '#666', fontWeight: '600' },
  panelTabTextActive: { color: '#34C759', fontWeight: '700' },
  duyuruHint: { marginHorizontal: 12, marginTop: 12, fontSize: 13, color: '#555', lineHeight: 18 },
  duyuruEditBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  duyuruEditBtnText: { color: '#34C759', fontWeight: '700' },
  duyuruActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  duyuruDeleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#dc3545',
  },
  duyuruDeleteBtnText: { color: '#fff', fontWeight: '700' },
  duyuruCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  duyuruCardText: { flex: 1, minWidth: 0 },
  duyuruThumb: { width: 72, height: 72, borderRadius: 10, marginLeft: 10, backgroundColor: '#eee' },
  duyuruModalBox: { maxHeight: '92%' },
  duyuruFieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 4 },
  dateTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  dateTouchText: { fontSize: 15, color: '#333' },
  dateTouchPlaceholder: { color: '#888' },
  dateTouchIcon: { fontSize: 16 },
  datePickerIosWrap: { marginBottom: 8 },
  datePickerIosActions: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  datePickerIosOk: { color: '#34C759', fontWeight: '700' },
  duyuruFormThumb: { width: '100%', height: 140, borderRadius: 10, marginBottom: 8, backgroundColor: '#eee' },
  uploadImageBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadImageBtnDisabled: { opacity: 0.6 },
  uploadImageBtnText: { color: '#fff', fontWeight: '700' },
  activeToggle: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f0faf2',
    borderWidth: 1,
    borderColor: '#cfe8d4',
  },
  activeToggleText: { color: '#2e6b3a', fontWeight: '600' },
  listContent: { paddingBottom: 24 },
  mahalleStrip: {
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f0faf2',
    borderBottomWidth: 1,
    borderBottomColor: '#cfe8d4',
  },
  mahalleStripLabel: { fontSize: 12, fontWeight: '600', color: '#2e6b3a', marginBottom: 6 },
  mahalleChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    backgroundColor: '#fff',
    maxWidth: 180,
  },
  mahalleChipActive: { backgroundColor: '#2e7d32' },
  mahalleChipText: { color: '#2e7d32', fontWeight: '600', fontSize: 13 },
  mahalleChipTextActive: { color: '#fff' },
  venueStrip: { paddingTop: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6e6e6' },
  venueStripLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6 },
  venueChips: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  venueChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#34C759',
    backgroundColor: '#fff',
    maxWidth: 200,
  },
  venueChipActive: { backgroundColor: '#34C759' },
  venueChipText: { color: '#34C759', fontWeight: '600', fontSize: 14 },
  venueChipTextActive: { color: '#fff' },
  manualBtn: { marginHorizontal: 12, marginTop: 12, backgroundColor: '#2e7d32', padding: 12, borderRadius: 10, alignItems: 'center' },
  manualBtnText: { color: '#fff', fontWeight: '700' },
  calHint: { marginHorizontal: 12, marginTop: 10, fontSize: 13, color: '#555', lineHeight: 18 },
  refreshCalBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#34C759',
    alignItems: 'center',
  },
  refreshCalText: { color: '#34C759', fontWeight: '700' },
  calWrap: { marginHorizontal: 12, marginTop: 10 },
  calSpinner: { marginVertical: 16 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6e6e6', marginTop: 12 },
  tab: { flex: 1, alignItems: 'center', padding: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#34C759' },
  tabText: { color: '#666' },
  tabTextActive: { color: '#34C759', fontWeight: '700' },
  selectedDateLine: { paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, fontWeight: '600', color: '#333' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ececec' },
  rowTitle: { fontWeight: '700', color: '#222' },
  rowSub: { marginTop: 4, color: '#555' },
  rowSubMuted: { marginTop: 4, color: '#888', fontSize: 12 },
  manualBadge: { marginTop: 6, color: '#1b5e20', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approve: { backgroundColor: '#34C759' },
  reject: { backgroundColor: '#dc3545' },
  actionText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 28, color: '#777', paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  modalBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, maxHeight: '90%' },
  modalTitle: { fontWeight: '700', fontSize: 17, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 8 },
  note: { minHeight: 70, textAlignVertical: 'top' },
  manualSlotLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  eventWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  eventChip: { borderWidth: 1, borderColor: '#34C759', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  eventChipActive: { backgroundColor: '#34C759' },
  eventChipText: { color: '#34C759', fontSize: 12 },
  eventChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', padding: 10 },
  saveBtn: { flex: 1, backgroundColor: '#34C759', borderRadius: 10, alignItems: 'center', padding: 10 },
  dayDetailModalBox: { maxHeight: '88%' },
  dayDetailHint: { fontSize: 13, color: '#666', marginBottom: 10 },
  dayDetailScroll: { maxHeight: 420 },
  dayDetailCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  dayDetailSpinner: { marginVertical: 20 },
  dayDetailEmpty: { textAlign: 'center', color: '#777', marginVertical: 16 },
  dayDetailCloseBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  dayDetailCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
