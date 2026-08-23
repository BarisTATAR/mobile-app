import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiUrl } from '../config/api';
import ListingMediaFormField from '../components/ListingMediaFormField';
import { mediaFilesFromItem } from '../utils/listingMedia';
import {
  getProvinces,
  getDistrictsForProvince,
  getNeighborhoods,
  DEFAULT_CITY,
} from '../services/turkeyAddressService';
import { digitsOnly } from '../utils/phoneInput';
import { LIMAN_UYE_SAAT_SECENEKLERI, normalizeLimanSaatForUyeList } from '../utils/limanSaatleri';
import { yoreselTimeSlotLabel } from '../constants/yoreselTimeSlots';

// Muğla ilçeleri (API yanıt vermezse veya henüz yüklenmediyse kullanılır)
const MUGLA_DISTRICTS_FALLBACK = ['Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris', 'Menteşe', 'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan'];

const LIST_TYPES = [
  { key: 'isletme', label: 'İşletme listesi' },
  { key: 'esnaf', label: 'Esnaf listesi' },
  { key: 'yoresel_etkinlik', label: 'Yöresel etkinlik işletmeleri' },
  { key: 'duyurular', label: 'Duyurular' },
  { key: 'isilanlari', label: 'İş ilanları' },
  { key: 'kampanyalar', label: 'Kampanyalar/İndirimler' },
  { key: 'uye_indirimi', label: 'Üye indirimleri' },
  { key: 'cekici', label: 'Çekici listesi' },
  { key: 'lastikci', label: 'Lastikçim listesi' },
  { key: 'taksi', label: 'Taksi listesi' },
];

// 2 grup: Duyurular, İş ilanları; diğerleri ayrı
const ADMIN_GROUPS = [
  { title: 'Duyurular', keys: ['duyurular', 'kampanyalar', 'uye_indirimi'] },
  { title: 'İş ilanları', keys: ['isilanlari'] },
  { title: 'Diğer listeler', keys: ['isletme', 'esnaf', 'yoresel_etkinlik', 'cekici', 'lastikci', 'taksi'] },
];

// İşletme listesinde faaliyet alanı filtresi (işletme eklerken seçilen alanlar)
const ACTIVITY_OPTIONS = [
  { id: '', label: 'Tümü' },
  { id: 'restorant', label: 'Restoran' },
  { id: 'cafe_bar', label: 'Cafe / Bar' },
  { id: 'tekne_turu', label: 'Tekne Turu' },
  { id: 'plaj_beach', label: 'Plaj / Beach' },
];

/** Günün tüm saat dilimleri 00:00 … 23:30 (30 dk) — çalışma + liman */
const LIMAN_TIME_OPTIONS = (() => {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 30) {
      const id = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      out.push({ id, label: id });
    }
  }
  return out;
})();

function normalizeLimanSaat(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const match = s.match(/^(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  let mm = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return '';
  h = Math.min(23, Math.max(0, h));
  mm = mm < 30 ? 0 : 30;
  const id = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return LIMAN_TIME_OPTIONS.some((o) => o.id === id) ? id : '';
}

/** Restoran / cafe / plaj: açılış = Kapalı veya saat */
const OPEN_TIME_OPTIONS = [{ id: 'Kapalı', label: 'Kapalı' }, ...LIMAN_TIME_OPTIONS];

/** Kapanış: boş, Kapalı veya saat */
const CLOSE_TIME_OPTIONS = [{ id: '', label: '— (yok)' }, { id: 'Kapalı', label: 'Kapalı' }, ...LIMAN_TIME_OPTIONS];

const OPENING_HOURS_FIELDS = [
  { name: 'weekdaysOpen', label: 'Hafta içi açılış', type: 'select', options: OPEN_TIME_OPTIONS },
  { name: 'weekdaysClose', label: 'Hafta içi kapanış', type: 'select', options: CLOSE_TIME_OPTIONS },
  { name: 'weekendOpen', label: 'Hafta sonu açılış', type: 'select', options: OPEN_TIME_OPTIONS },
  { name: 'weekendClose', label: 'Hafta sonu kapanış', type: 'select', options: CLOSE_TIME_OPTIONS },
];

const MENU_FIELDS = [
  { name: 'menuPdfUrl', label: 'Menü PDF URL' },
  { name: 'menuImageUrl', label: 'Menü fotoğrafı', type: 'image' },
];

const MEDIA_FILES_FIELD = { name: 'mediaFiles', label: 'Fotoğraf / PDF', type: 'mediaFiles' };

const LISTING_TYPES_WITH_MEDIA = ['isletme', 'esnaf', 'cekici', 'lastikci', 'taksi', 'yoresel_etkinlik'];

const LOCATION_FIELD = {
  name: 'googleLocation',
  label: 'Konum (Google linki veya adres)',
  placeholder: 'Örn: Konak, Atatürk Cd., 48500 Yatağan/Muğla',
};

function normalizeOpeningOpen(raw) {
  const s = String(raw ?? '').trim();
  if (!s || /^kapalı$/i.test(s) || s === 'Kapalı') return 'Kapalı';
  return normalizeLimanSaat(s) || 'Kapalı';
}

function normalizeOpeningClose(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^kapalı$/i.test(s) || s === 'Kapalı') return 'Kapalı';
  return normalizeLimanSaat(s) || '';
}

/** Yöresel etkinlik: admin listesinde alt grup (hizmet alanı) filtresi */
const YORESEL_SERVICE_FILTER_OPTIONS = [
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

const YORESEL_TAG_LABELS = {
  muzisyen: 'Müzisyen',
  asci: 'Aşçı',
  susleme: 'Süsleme',
  zurna: 'Zurna',
  park_salon: 'Park / salon',
  mekan: 'Mekan',
  kuafor: 'Kuaför',
  arac_kiralama: 'Araç kiralama',
};

const ESNAF_CATEGORY_OPTIONS = [
  { id: '', label: 'Tümü' },
  { id: 'Berber / Kuaför', label: 'Berber / Kuaför' },
  { id: 'Terzi', label: 'Terzi' },
  { id: 'Elektrikçi', label: 'Elektrikçi' },
  { id: 'Tesisatçı', label: 'Tesisatçı' },
  { id: 'Boyacı', label: 'Boyacı' },
  { id: 'Oto Tamir', label: 'Oto Tamir' },
  { id: 'Marangoz', label: 'Marangoz' },
  { id: 'Sıvacı', label: 'Sıvacı' },
  { id: 'Sıvı tesisat', label: 'Sıvı tesisat' },
  { id: 'Alçıcı', label: 'Alçıcı' },
  { id: 'Telefon satış & arıza', label: 'Telefon satış & arıza' },
  { id: 'Veteriner', label: 'Veteriner' },
  { id: 'Manav', label: 'Manav' },
  { id: 'Kaynakçı', label: 'Kaynakçı' },
  { id: 'Müzisyen', label: 'Müzisyen' },
  { id: 'Aşçı', label: 'Aşçı' },
  { id: 'Kuyumcu', label: 'Kuyumcu' },
  { id: 'Diğer', label: 'Diğer' },
];

const ISLETME_FIELDS = [
  { name: 'businessName', label: 'İşletme adı', required: true },
  { name: 'password', label: 'Şifre (en az 6 karakter; güncellemede boş bırakılırsa değişmez)', required: true },
  { name: 'phone', label: 'Cep telefonu' },
  {
    name: 'activityField',
    label: 'Faaliyet alanı',
    type: 'select',
    options: ACTIVITY_OPTIONS.filter((o) => o.id),
    required: true,
  },
  { name: 'addressCity', label: 'İl' },
  { name: 'addressDistrict', label: 'İlçe' },
  { name: 'addressNeighborhood', label: 'Mahalle' },
  { name: LOCATION_FIELD.name, label: LOCATION_FIELD.label, placeholder: LOCATION_FIELD.placeholder },
  {
    name: 'limanCikisSaati',
    label: 'Liman çıkış saati',
    type: 'limanTime',
    showIf: (fd) => fd.activityField === 'tekne_turu',
  },
  {
    name: 'limanGelisSaati',
    label: 'Liman geliş saati',
    type: 'limanTime',
    showIf: (fd) => fd.activityField === 'tekne_turu',
  },
  {
    name: 'weekdaysOpen',
    label: 'Hafta içi açılış',
    type: 'select',
    options: OPEN_TIME_OPTIONS,
    showIf: (fd) => fd.activityField !== 'tekne_turu',
  },
  {
    name: 'weekdaysClose',
    label: 'Hafta içi kapanış',
    type: 'select',
    options: CLOSE_TIME_OPTIONS,
    showIf: (fd) => fd.activityField !== 'tekne_turu',
  },
  {
    name: 'weekendOpen',
    label: 'Hafta sonu açılış',
    type: 'select',
    options: OPEN_TIME_OPTIONS,
    showIf: (fd) => fd.activityField !== 'tekne_turu',
  },
  {
    name: 'weekendClose',
    label: 'Hafta sonu kapanış',
    type: 'select',
    options: CLOSE_TIME_OPTIONS,
    showIf: (fd) => fd.activityField !== 'tekne_turu',
  },
  { name: 'googleReviewLink', label: 'Google değerlendirme linki' },
  { name: 'website', label: 'Website' },
  { name: 'instagram', label: 'Instagram' },
  { name: 'hasChargingStation', label: 'Elektrikli şarj istasyonu', type: 'checkbox' },
  { name: 'hasFreeParking', label: 'Ücretsiz otopark', type: 'checkbox' },
  { name: 'hasFreeValet', label: 'Ücretsiz vale', type: 'checkbox' },
  { name: 'hasPaidParking', label: 'Ücretli otopark', type: 'checkbox' },
  { name: 'hasPaidValet', label: 'Ücretli vale', type: 'checkbox' },
  MEDIA_FILES_FIELD,
  { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
  { name: 'premium', label: 'Premium (kampanya ve iş ilanı girebilir)', type: 'checkbox' },
];

const FIELD_CONFIG = {
  isletme: ISLETME_FIELDS,
  esnaf: [
    { name: 'name', label: 'Esnaf / İşletme adı', required: true },
    { name: 'phone', label: 'Telefon' },
    { name: 'category', label: 'Kategori', type: 'select', options: ESNAF_CATEGORY_OPTIONS.filter((o) => o.id) },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe (kullanıcı filtresinde listelenir)' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { ...LOCATION_FIELD },
    { name: 'description', label: 'Açıklama' },
    MEDIA_FILES_FIELD,
    ...OPENING_HOURS_FIELDS,
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
    { name: 'premium', label: 'Premium (kampanya ve iş ilanı girebilir)', type: 'checkbox' },
    {
      name: 'password',
      label: 'Premium giriş şifresi (en az 6 karakter; güncellemede boş bırakılırsa değişmez)',
      showIf: (fd) => !!fd.premium,
    },
  ],
  yoresel_etkinlik: [
    { name: 'multiOperator', label: 'Birden fazla mekan (aynı giriş kullanıcı adı ve şifre)', type: 'checkbox' },
    { name: 'loginName', label: 'Giriş kullanıcı adı (ortak)', showIf: (fd) => !!fd.multiOperator },
    {
      name: 'venueNamesText',
      label: 'Mekan adları (her satır bir işletme; örn. 5 park)',
      type: 'textarea',
      showIf: (fd) => !!fd.multiOperator,
    },
    {
      name: 'venueMahalleText',
      label: 'Mahalle (zorunlu: tek satır = tüm mekanlara ortak; veya her satır bir mekan adıyla aynı sırada)',
      type: 'textarea',
      required: true,
      showIf: (fd) => !!fd.multiOperator,
    },
    { name: 'name', label: 'İşletme / hizmet adı', required: true, showIf: (fd) => !fd.multiOperator },
    { name: 'password', label: 'Şifre (en az 6 karakter; güncellemede boş bırakılırsa değişmez)', required: true },
    { name: 'phone', label: 'Telefon' },
    { name: 'addressDistrict', label: 'İlçe (bölge)', required: true },
    { name: 'description', label: 'Açıklama' },
    { name: 'serviceMuzisyen', label: 'Müzisyen', type: 'checkbox' },
    { name: 'serviceAsci', label: 'Aşçı', type: 'checkbox' },
    { name: 'serviceSusleme', label: 'Süsleme / organizasyon', type: 'checkbox' },
    { name: 'serviceZurna', label: 'Zurna ekibi', type: 'checkbox' },
    { name: 'serviceParkSalon', label: 'Park / salon', type: 'checkbox' },
    { name: 'serviceMekan', label: 'Mekan', type: 'checkbox' },
    { name: 'serviceKuafor', label: 'Kuaför', type: 'checkbox' },
    { name: 'serviceAracKiralama', label: 'Araç kiralama', type: 'checkbox' },
    { name: 'offeredGunduz', label: 'Gündüz (10:00 - 18:00) rezervasyon', type: 'checkbox' },
    { name: 'offeredAksam', label: 'Akşam (18:00 - 23:59) rezervasyon', type: 'checkbox' },
    { name: 'offeredTamGun', label: 'Tam gün (10:00 - 23:59) rezervasyon', type: 'checkbox' },
    MEDIA_FILES_FIELD,
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
    { name: 'premium', label: 'Premium (kampanya ve iş ilanı girebilir)', type: 'checkbox' },
  ],
  uye_indirimi: [
    { name: 'memberId', label: 'Üye numarası (kullanıcı profili)', required: true },
    { name: 'business', label: 'İşletme', type: 'businessPicker', required: true },
    { name: 'title', label: 'İndirim başlığı' },
    { name: 'description', label: 'Açıklama' },
    { name: 'discountPercent', label: 'İndirim yüzdesi (0–100)', keyboard: 'numeric' },
    { name: 'validUntil', label: 'Geçerlilik bitiş tarihi', type: 'date' },
    { name: 'active', label: 'Aktif', type: 'checkbox' },
    { name: 'note', label: 'Yönetici notu (işletmeye gösterilmez)' },
  ],
  kampanyalar: [
    { name: 'title', label: 'Başlık', required: true },
    { name: 'companyName', label: 'İşletme adı' },
    { name: 'contactPhone', label: 'İletişim numarası' },
    { name: 'discountText', label: 'İndirim metni' },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { name: 'startDate', label: 'Kampanya başlangıç tarihi', type: 'date' },
    { name: 'imageUrl', label: 'Fotoğraf', type: 'image' },
    { name: 'licenseExpiry', label: 'Kampanya bitiş tarihi', type: 'date' },
  ],
  duyurular: [
    { name: 'title', label: 'Başlık', required: true },
    { name: 'description', label: 'Açıklama' },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { name: 'startDate', label: 'Başlangıç tarihi', type: 'date' },
    { name: 'endDate', label: 'Bitiş tarihi', type: 'date' },
    { name: 'imageUrl', label: 'Fotoğraf', type: 'image' },
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
  ],
  isilanlari: [
    { name: 'title', label: 'İlan başlığı', required: true },
    { name: 'company', label: 'Firma / İşletme adı' },
    { name: 'description', label: 'Açıklama' },
    { name: 'contactPhone', label: 'İletişim telefonu' },
    { name: 'contactEmail', label: 'İletişim e-posta' },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { name: 'imageUrl', label: 'Fotoğraf', type: 'image' },
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
  ],
  cekici: [
    { name: 'companyName', label: 'Firma adı', required: true },
    { name: 'phone', label: 'Telefon' },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { ...LOCATION_FIELD },
    { name: 'notes', label: 'Not' },
    MEDIA_FILES_FIELD,
    ...OPENING_HOURS_FIELDS,
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
    { name: 'premium', label: 'Premium (kampanya ve iş ilanı girebilir)', type: 'checkbox' },
    {
      name: 'password',
      label: 'Premium giriş şifresi (en az 6 karakter; güncellemede boş bırakılırsa değişmez)',
      showIf: (fd) => !!fd.premium,
    },
  ],
  lastikci: [
    { name: 'name', label: 'Ad', required: true },
    { name: 'phone', label: 'Telefon' },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { ...LOCATION_FIELD },
    { name: 'notes', label: 'Not' },
    MEDIA_FILES_FIELD,
    ...OPENING_HOURS_FIELDS,
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
    { name: 'premium', label: 'Premium (kampanya ve iş ilanı girebilir)', type: 'checkbox' },
    {
      name: 'password',
      label: 'Premium giriş şifresi (en az 6 karakter; güncellemede boş bırakılırsa değişmez)',
      showIf: (fd) => !!fd.premium,
    },
  ],
  taksi: [
    { name: 'companyName', label: 'Firma / Taksi adı', required: true },
    { name: 'phone', label: 'Telefon' },
    { name: 'addressCity', label: 'İl' },
    { name: 'addressDistrict', label: 'İlçe' },
    { name: 'addressNeighborhood', label: 'Mahalle' },
    { ...LOCATION_FIELD },
    { name: 'notes', label: 'Not' },
    MEDIA_FILES_FIELD,
    ...OPENING_HOURS_FIELDS,
    { name: 'licenseExpiry', label: 'Lisans bitiş süresi', type: 'date' },
    { name: 'premium', label: 'Premium (kampanya ve iş ilanı girebilir)', type: 'checkbox' },
    {
      name: 'password',
      label: 'Premium giriş şifresi (en az 6 karakter; güncellemede boş bırakılırsa değişmez)',
      showIf: (fd) => !!fd.premium,
    },
  ],
};

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

/** Boş geçerli; doluysa bugün veya sonrası olmalı (esnaf, çekici, lastikçi, taksi vb.) */
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
  if (chosen < t) {
    return 'Lisans bitiş süresi bugünün tarihinden önce olamaz.';
  }
  return null;
}

const ADMIN_TYPES_WITH_LICENSE_EXPIRY = [
  'isletme',
  'esnaf',
  'kampanyalar',
  'duyurular',
  'cekici',
  'lastikci',
  'taksi',
  'isilanlari',
  'yoresel_etkinlik',
];

function getItemTitle(type, item) {
  if (!item) return '';
  switch (type) {
    case 'isletme': return item.businessName || item._id;
    case 'esnaf': return item.name || item._id;
    case 'kampanyalar': return item.title || item._id;
    case 'duyurular': return item.title || item._id;
    case 'isilanlari': return item.title || item._id;
    case 'cekici': return item.companyName || item._id;
    case 'lastikci': return item.name || item._id;
    case 'taksi': return item.companyName || item._id;
    case 'yoresel_etkinlik': return item.name || item._id;
    case 'uye_indirimi': {
      const biz = item.business?.businessName || 'İşletme';
      return `${item.memberId || '?'} → ${biz}`;
    }
    default: return item._id;
  }
}

export default function AdminMainScreen({ route, navigation }) {
  const [selectedType, setSelectedType] = useState('isletme');
  const selectedTypeRef = useRef(selectedType);
  const [list, setList] = useState([]);
  const [homeImageUrl, setHomeImageUrl] = useState('');
  const [homeImageSaving, setHomeImageSaving] = useState(false);
  const [homeImageUploading, setHomeImageUploading] = useState(false);
  const [homePhotoModalVisible, setHomePhotoModalVisible] = useState(false);
  const [listError, setListError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  // İl / İlçe / Mahalle seçici
  const [provinces, setProvinces] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [neighborhoodsList, setNeighborhoodsList] = useState([]);
  const [addressPickerType, setAddressPickerType] = useState(null); // 'city' | 'district' | 'neighborhood' | null
  const [addressPickerTarget, setAddressPickerTarget] = useState('form'); // 'form' | 'list' — liste sorgusu kullanıcı API ile aynı: city, district, neighborhood
  const [addressPickerLoading, setAddressPickerLoading] = useState(false);
  /** Liste filtreleri (GET ?district=&neighborhood=; il sabit Muğla) */
  const [listFilterDistrict, setListFilterDistrict] = useState('');
  const [listFilterNeighborhood, setListFilterNeighborhood] = useState('');
  const [listFilterNeighborhoodsList, setListFilterNeighborhoodsList] = useState([]);
  const [listFilterNhoodLoading, setListFilterNhoodLoading] = useState(false);
  const [activityFieldFilter, setActivityFieldFilter] = useState(''); // İşletme listesinde faaliyet alanı
  const [esnafCategoryFilter, setEsnafCategoryFilter] = useState(''); // Esnaf listesinde kategori
  const [yoreselServiceTagFilter, setYoreselServiceTagFilter] = useState(''); // Yöresel etkinlik alt grup
  const [imageUploading, setImageUploading] = useState(false);
  const [datePickerField, setDatePickerField] = useState(null); // 'licenseExpiry' | 'startDate' | 'endDate' | null
  const [datePickerTemp, setDatePickerTemp] = useState(new Date()); // iOS spinner için geçici tarih
  const [selectModalField, setSelectModalField] = useState(null); // 'category' vb. select alanı
  /** İşletme üye ekranıyla aynı: alttan liman saat sayfası */
  const [limanTimePickerField, setLimanTimePickerField] = useState(null); // 'limanCikisSaati' | 'limanGelisSaati' | null
  const [businessPickerOptions, setBusinessPickerOptions] = useState([]);

  const loadBusinessPickerOptions = useCallback(async () => {
    try {
      const urls = [
        '/api/admin/businesses-picker',
        '/api/admin/isletme?forPicker=1',
        '/api/admin/isletme',
      ];
      let options = [];
      for (const path of urls) {
        const res = await fetch(apiUrl(path), { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) continue;
        const raw = Array.isArray(data.list) ? data.list : [];
        options = raw.map((b) =>
          b.id != null && b.label != null
            ? { id: String(b.id), label: String(b.label) }
            : {
                id: String(b._id),
                label: (b.businessName || String(b._id)) + (b.approved === false ? ' (onaysız)' : ''),
              }
        );
        if (options.length > 0) break;
      }
      setBusinessPickerOptions(options);
    } catch {
      setBusinessPickerOptions([]);
    }
  }, []);

  useEffect(() => {
    if (selectedType === 'uye_indirimi') loadBusinessPickerOptions();
  }, [selectedType, loadBusinessPickerOptions]);

  const pickAndUploadImage = useCallback(async () => {
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
      setImageUploading(true);
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
        setFormData((prev) => ({ ...prev, imageUrl: data.url }));
      } else {
        Alert.alert('Hata', data.error || 'Yükleme başarısız.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setImageUploading(false);
    }
  }, []);

  const fetchList = useCallback(async (activityOverride, categoryOverride, yoreselTagOverride) => {
    const typeRequested = selectedType;
    selectedTypeRef.current = typeRequested;
    setLoading(true);
    setListError(null);
    const activity = activityOverride !== undefined ? activityOverride : activityFieldFilter;
    const category = categoryOverride !== undefined ? categoryOverride : esnafCategoryFilter;
    const yoreselTag = yoreselTagOverride !== undefined ? yoreselTagOverride : yoreselServiceTagFilter;
    try {
      let url;
      if (typeRequested === 'duyurular') url = apiUrl('/api/admin/list/duyurular');
      else if (typeRequested === 'kampanyalar') url = apiUrl('/api/admin/list/kampanyalar');
      else url = apiUrl(`/api/admin/${typeRequested}`);
      const params = [];
      if (typeRequested === 'isletme' && activity) params.push(`activityField=${encodeURIComponent(activity)}`);
      if (typeRequested === 'esnaf' && category) params.push(`category=${encodeURIComponent(category)}`);
      if (typeRequested === 'yoresel_etkinlik' && yoreselTag) {
        params.push(`serviceTag=${encodeURIComponent(yoreselTag)}`);
      }
      if (listFilterDistrict) params.push(`district=${encodeURIComponent(listFilterDistrict.trim())}`);
      if (listFilterNeighborhood) params.push(`neighborhood=${encodeURIComponent(listFilterNeighborhood.trim())}`);
      if (params.length) url += (url.includes('?') ? '&' : '?') + params.join('&');
      const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json().catch(() => ({}));
      if (selectedTypeRef.current !== typeRequested) return;
      if (res.ok) {
        const items = data.list ?? data.businesses ?? data;
        setList(Array.isArray(items) ? items : []);
        setListError(null);
      } else {
        setList([]);
        setListError(data.error || data.message || `Hata ${res.status}`);
      }
    } catch (e) {
      if (selectedTypeRef.current !== typeRequested) return;
      setList([]);
      setListError('Sunucuya bağlanılamadı. Backend çalışıyor mu?');
    } finally {
      if (selectedTypeRef.current === typeRequested) setLoading(false);
    }
  }, [selectedType, activityFieldFilter, esnafCategoryFilter, yoreselServiceTagFilter, listFilterDistrict, listFilterNeighborhood]);

  const onListele = () => fetchList();

  // Liste türü değişince ilgili filtreleri sıfırla ve listeyi temizle (Duyurular/Kampanyalar ayrı listeler)
  useEffect(() => {
    selectedTypeRef.current = selectedType;
    if (selectedType !== 'isletme') setActivityFieldFilter('');
    if (selectedType !== 'esnaf') setEsnafCategoryFilter('');
    if (selectedType !== 'yoresel_etkinlik') setYoreselServiceTagFilter('');
    setList([]);
  }, [selectedType]);

  // Liste türü değişince listeyi yükle (kısa gecikme ile UI önce güncellenir)
  useEffect(() => {
    const t = setTimeout(() => fetchList(), 50);
    return () => clearTimeout(t);
  }, [fetchList]);

  // Ana sayfa fotoğrafı ayarını yükle
  const loadAppSettings = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/app-settings'), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.homeImageUrl != null) setHomeImageUrl(String(data.homeImageUrl).trim());
    } catch (e) {
      setHomeImageUrl('');
    }
  }, []);
  useEffect(() => { loadAppSettings(); }, [loadAppSettings]);

  const saveHomeImage = useCallback(async () => {
    setHomeImageSaving(true);
    try {
      const res = await fetch(apiUrl('/api/app-settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeImageUrl: (homeImageUrl || '').trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setHomeImageUrl((data.homeImageUrl || '').trim());
        Alert.alert('Kaydedildi', 'Ana sayfa fotoğrafı güncellendi.');
      } else Alert.alert('Hata', data.error || 'Kaydedilemedi.');
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı hatası.');
    } finally {
      setHomeImageSaving(false);
    }
  }, [homeImageUrl]);

  const uploadHomeImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin', 'Galeri erişimi gerekli.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setHomeImageUploading(true);
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('image', { uri, type: 'image/jpeg', name: 'home.jpg' });
      const res = await fetch(apiUrl('/api/upload/image'), { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setHomeImageUrl(data.url);
        const patchRes = await fetch(apiUrl('/api/app-settings'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ homeImageUrl: data.url }),
        });
        if (patchRes.ok) Alert.alert('Kaydedildi', 'Ana sayfa fotoğrafı yüklendi ve kaydedildi.');
        else Alert.alert('Uyarı', 'Fotoğraf yüklendi ancak ayar kaydedilemedi. Kaydet butonuna basın.');
      } else Alert.alert('Hata', data.error || 'Yükleme başarısız.');
    } catch (e) {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setHomeImageUploading(false);
    }
  }, []);

  // İl listesi (admin il/ilçe/mahalle seçimi için). Muğla öncelikli.
  useEffect(() => {
    let cancelled = false;
    getProvinces().then((list) => {
      if (!cancelled) setProvinces(list);
    });
    return () => { cancelled = true; };
  }, []);

  // İlçe listesini ekran açıldığında ve il değişince hazırla (API gelmeden de yedek liste olsun)
  useEffect(() => {
    const city = formData.addressCity || DEFAULT_CITY;
    const list = getDistrictsForProvince(provinces, city);
    if (list && list.length > 0) {
      setDistrictsList(list);
    } else {
      setDistrictsList(MUGLA_DISTRICTS_FALLBACK.map((name) => ({ id: name, name })));
    }
  }, [provinces, formData.addressCity]);

  // Modal açıldığında ilçe listesini de güncelle (adres formu olan türler için)
  useEffect(() => {
    const withAddress = [
      'isletme',
      'esnaf',
      'yoresel_etkinlik',
      'cekici',
      'lastikci',
      'kampanyalar',
      'duyurular',
      'isilanlari',
      'taksi',
    ].includes(selectedType);
    if (!modalVisible || !withAddress) return;
    const city = formData.addressCity || DEFAULT_CITY;
    const list = getDistrictsForProvince(provinces, city);
    if (list && list.length > 0) {
      setDistrictsList(list);
    } else {
      setDistrictsList(MUGLA_DISTRICTS_FALLBACK.map((name) => ({ id: name, name })));
    }
  }, [modalVisible, selectedType, formData.addressCity, provinces]);

  // Liste filtresi mahalleleri (kullanıcı listeleriyle aynı kaynak)
  useEffect(() => {
    if (!listFilterDistrict) {
      setListFilterNeighborhoodsList([]);
      setListFilterNeighborhood('');
      setListFilterNhoodLoading(false);
      return;
    }
    let cancelled = false;
    setListFilterNhoodLoading(true);
    getNeighborhoods(DEFAULT_CITY, listFilterDistrict)
      .then((list) => {
        if (!cancelled) setListFilterNeighborhoodsList(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setListFilterNeighborhoodsList([]);
      })
      .finally(() => {
        if (!cancelled) setListFilterNhoodLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listFilterDistrict]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  }, [fetchList]);

  const openListAddressPicker = useCallback((type) => {
    setAddressPickerTarget('list');
    if (type === 'district') {
      let list = getDistrictsForProvince(provinces, DEFAULT_CITY);
      if (!list || list.length === 0) {
        list = MUGLA_DISTRICTS_FALLBACK.map((name) => ({ id: name, name }));
      }
      setDistrictsList(list);
      setAddressPickerType('district');
      return;
    }
    if (type === 'neighborhood') {
      const d = listFilterDistrict || '';
      if (!d) {
        Alert.alert('Önce ilçe seçin', 'Mahalle listesi için ilçe seçmelisiniz.');
        setAddressPickerTarget('form');
        return;
      }
      setAddressPickerType('neighborhood');
    }
  }, [listFilterDistrict, provinces]);

  const openAddressPicker = useCallback((type) => {
    setAddressPickerTarget('form');
    if (type === 'city') {
      setAddressPickerType('city');
      return;
    }
    if (type === 'district') {
      const city = formData.addressCity || DEFAULT_CITY;
      let list = getDistrictsForProvince(provinces, city);
      if (!list || list.length === 0) {
        list = MUGLA_DISTRICTS_FALLBACK.map((name) => ({ id: name, name }));
      }
      setDistrictsList(list);
      setAddressPickerType('district');
      return;
    }
    if (type === 'neighborhood') {
      const city = formData.addressCity || DEFAULT_CITY;
      const district = formData.addressDistrict || '';
      if (!district) {
        Alert.alert('Önce ilçe seçin', 'Mahalle listesi için ilçe seçmelisiniz.');
        return;
      }
      setNeighborhoodsList([]);
      setAddressPickerLoading(true);
      setAddressPickerType('neighborhood');
      getNeighborhoods(city, district)
        .then((list) => {
          setNeighborhoodsList(Array.isArray(list) ? list : []);
        })
        .catch(() => setNeighborhoodsList([]))
        .finally(() => setAddressPickerLoading(false));
    }
  }, [formData.addressCity, formData.addressDistrict, provinces]);

  const openAdd = () => {
    setModalMode('add');
    setEditingItem(null);
    const validIsletmeActivity = ACTIVITY_OPTIONS.filter((o) => o.id).map((o) => o.id);
    const initial = {};
    (FIELD_CONFIG[selectedType] || []).forEach((f) => {
      if (f.type === 'checkbox') initial[f.name] = false;
      else if ((selectedType === 'isletme' || selectedType === 'esnaf' || selectedType === 'cekici' || selectedType === 'lastikci' || selectedType === 'kampanyalar' || selectedType === 'duyurular' || selectedType === 'isilanlari' || selectedType === 'taksi') && f.name === 'addressCity') initial[f.name] = DEFAULT_CITY;
      else if (selectedType === 'isletme' && (f.name === 'weekdaysOpen' || f.name === 'weekendOpen')) initial[f.name] = 'Kapalı';
      else if (['esnaf', 'cekici', 'lastikci', 'taksi'].includes(selectedType) && (f.name === 'weekdaysOpen' || f.name === 'weekendOpen')) initial[f.name] = 'Kapalı';
      else if (selectedType === 'isletme' && f.name === 'activityField') {
        initial[f.name] =
          activityFieldFilter && validIsletmeActivity.includes(activityFieldFilter)
            ? activityFieldFilter
            : 'restorant';
      } else initial[f.name] = '';
    });
    if (selectedType === 'yoresel_etkinlik') {
      initial.offeredGunduz = true;
      initial.offeredAksam = true;
      initial.offeredTamGun = true;
    }
    if (selectedType === 'uye_indirimi') {
      initial.active = true;
    }
    if (selectedType === 'isletme' && initial.activityField === 'tekne_turu') {
      if (!initial.limanCikisSaati) initial.limanCikisSaati = '09:00';
      if (!initial.limanGelisSaati) initial.limanGelisSaati = '18:00';
      initial.weekdaysOpen = 'Kapalı';
      initial.weekdaysClose = '';
      initial.weekendOpen = 'Kapalı';
      initial.weekendClose = '';
    }
    if (LISTING_TYPES_WITH_MEDIA.includes(selectedType)) {
      initial.mediaFiles = [];
    }
    setFormData(initial);
    setModalVisible(true);
  };

  const openEdit = async (item) => {
    setModalMode('edit');
    setEditingItem(item);
    let yoreselGroupSiblings = [item];
    const yoreselGroupId =
      selectedType === 'yoresel_etkinlik' ? String(item.loginGroupId || '').trim() : '';
    if (yoreselGroupId) {
      try {
        const res = await fetch(
          apiUrl(`/api/admin/yoresel_etkinlik?loginGroupId=${encodeURIComponent(yoreselGroupId)}`)
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.list) && data.list.length > 0) {
          yoreselGroupSiblings = [...data.list].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'tr')
          );
        }
      } catch (e) {
        yoreselGroupSiblings = list
          .filter((x) => String(x.loginGroupId || '').trim() === yoreselGroupId)
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
        if (yoreselGroupSiblings.length === 0) yoreselGroupSiblings = [item];
      }
    }
    const initial = {};
    (FIELD_CONFIG[selectedType] || []).forEach((f) => {
      if (selectedType === 'yoresel_etkinlik' && f.type === 'checkbox') {
        if (f.name.startsWith('offered')) {
          const slots = Array.isArray(item.offeredTimeSlots) ? item.offeredTimeSlots : [];
          const slotByField = {
            offeredGunduz: 'gunduz',
            offeredAksam: 'aksam',
            offeredTamGun: 'tam_gun',
          };
          const t = slotByField[f.name];
          initial[f.name] = t ? slots.includes(t) : false;
        } else {
          const tags = Array.isArray(item.serviceTags) ? item.serviceTags : [];
          const tagByField = {
            serviceMuzisyen: 'muzisyen',
            serviceAsci: 'asci',
            serviceSusleme: 'susleme',
            serviceZurna: 'zurna',
            serviceParkSalon: 'park_salon',
            serviceMekan: 'mekan',
            serviceKuafor: 'kuafor',
            serviceAracKiralama: 'arac_kiralama',
          };
          const t = tagByField[f.name];
          initial[f.name] = t ? tags.includes(t) : false;
        }
      } else if (f.type === 'checkbox') {
        initial[f.name] = !!item[f.name];
      } else if (selectedType === 'isletme') {
        if (f.name === 'addressCity') initial[f.name] = item.address?.city != null ? String(item.address.city) : 'Muğla';
        else if (f.name === 'addressDistrict') initial[f.name] = item.address?.district != null ? String(item.address.district) : '';
        else if (f.name === 'addressNeighborhood') initial[f.name] = item.address?.neighborhood != null ? String(item.address.neighborhood) : '';
        else if (f.name === 'weekdaysOpen') initial[f.name] = normalizeOpeningOpen(item.openingHours?.weekdays?.open);
        else if (f.name === 'weekdaysClose') initial[f.name] = normalizeOpeningClose(item.openingHours?.weekdays?.close);
        else if (f.name === 'weekendOpen') initial[f.name] = normalizeOpeningOpen(item.openingHours?.weekend?.open);
        else if (f.name === 'weekendClose') initial[f.name] = normalizeOpeningClose(item.openingHours?.weekend?.close);
        else if (f.name === 'limanCikisSaati' || f.name === 'limanGelisSaati') {
          initial[f.name] = normalizeLimanSaatForUyeList(item[f.name]);
        } else { const v = item[f.name]; initial[f.name] = v != null ? String(v) : ''; }
      } else if (selectedType === 'esnaf') {
        if (f.name === 'addressCity') initial[f.name] = item.address?.city != null ? String(item.address.city) : DEFAULT_CITY;
        else if (f.name === 'addressDistrict') initial[f.name] = item.address?.district != null ? String(item.address.district) : '';
        else if (f.name === 'addressNeighborhood') initial[f.name] = item.address?.neighborhood != null ? String(item.address.neighborhood) : '';
        else if (f.name === 'weekdaysOpen') initial[f.name] = normalizeOpeningOpen(item.openingHours?.weekdays?.open);
        else if (f.name === 'weekdaysClose') initial[f.name] = normalizeOpeningClose(item.openingHours?.weekdays?.close);
        else if (f.name === 'weekendOpen') initial[f.name] = normalizeOpeningOpen(item.openingHours?.weekend?.open);
        else if (f.name === 'weekendClose') initial[f.name] = normalizeOpeningClose(item.openingHours?.weekend?.close);
        else if (f.name === 'password') initial[f.name] = '';
        else { const v = item[f.name]; initial[f.name] = v != null ? String(v) : ''; }
      } else if (selectedType === 'yoresel_etkinlik') {
        if (f.name === 'addressDistrict') initial[f.name] = item.address?.district != null ? String(item.address.district) : '';
        else { const v = item[f.name]; initial[f.name] = v != null ? String(v) : ''; }
      } else if (selectedType === 'cekici' || selectedType === 'lastikci' || selectedType === 'taksi') {
        if (f.name === 'addressCity') initial[f.name] = (item.address?.city ?? item.city) != null ? String(item.address?.city ?? item.city) : DEFAULT_CITY;
        else if (f.name === 'addressDistrict') initial[f.name] = (item.address?.district ?? item.district) != null ? String(item.address?.district ?? item.district) : '';
        else if (f.name === 'addressNeighborhood') initial[f.name] = (item.address?.neighborhood ?? item.neighborhood) != null ? String(item.address?.neighborhood ?? item.neighborhood) : '';
        else if (f.name === 'weekdaysOpen') initial[f.name] = normalizeOpeningOpen(item.openingHours?.weekdays?.open);
        else if (f.name === 'weekdaysClose') initial[f.name] = normalizeOpeningClose(item.openingHours?.weekdays?.close);
        else if (f.name === 'weekendOpen') initial[f.name] = normalizeOpeningOpen(item.openingHours?.weekend?.open);
        else if (f.name === 'weekendClose') initial[f.name] = normalizeOpeningClose(item.openingHours?.weekend?.close);
        else if (f.name === 'password') initial[f.name] = '';
        else { const v = item[f.name]; initial[f.name] = v != null ? String(v) : ''; }
      } else if (selectedType === 'kampanyalar' || selectedType === 'duyurular') {
        if (f.name === 'addressCity') initial[f.name] = item.address?.city != null ? String(item.address.city) : DEFAULT_CITY;
        else if (f.name === 'addressDistrict') initial[f.name] = item.address?.district != null ? String(item.address.district) : '';
        else if (f.name === 'addressNeighborhood') initial[f.name] = item.address?.neighborhood != null ? String(item.address.neighborhood) : '';
        else { const v = item[f.name]; initial[f.name] = v != null ? String(v) : ''; }
      } else if (selectedType === 'isilanlari') {
        if (f.name === 'addressCity') initial[f.name] = item.address?.city != null ? String(item.address.city) : DEFAULT_CITY;
        else if (f.name === 'addressDistrict') initial[f.name] = item.address?.district != null ? String(item.address.district) : '';
        else if (f.name === 'addressNeighborhood') initial[f.name] = item.address?.neighborhood != null ? String(item.address.neighborhood) : '';
        else { const v = item[f.name]; initial[f.name] = v != null ? String(v) : ''; }
      } else if (selectedType === 'uye_indirimi') {
        if (f.name === 'business') {
          initial.business = typeof item.business === 'object' ? item.business._id : item.business;
        } else if (f.name === 'discountPercent') {
          initial[f.name] = item.discountPercent != null ? String(item.discountPercent) : '';
        } else {
          const v = item[f.name];
          initial[f.name] = v != null ? String(v) : '';
        }
      } else {
        const v = item[f.name];
        initial[f.name] = v != null ? String(v) : '';
      }
    });
    if ((selectedType === 'kampanyalar' || selectedType === 'duyurular') && item.business) {
      initial.business = typeof item.business === 'object' ? item.business._id : item.business;
    }
    if (selectedType === 'yoresel_etkinlik' && yoreselGroupId) {
      initial.multiOperator = true;
      initial.loginName = String(item.loginName || yoreselGroupSiblings[0]?.loginName || '').trim();
      initial.venueNamesText = yoreselGroupSiblings.map((s) => s.name || '').join('\n');
      const neighborhoods = yoreselGroupSiblings.map((s) =>
        String(s.address?.neighborhood ?? '').trim()
      );
      const allSameMahalle =
        neighborhoods.length > 0 && neighborhoods.every((n) => n === neighborhoods[0]);
      initial.venueMahalleText = allSameMahalle
        ? neighborhoods[0] || ''
        : neighborhoods.join('\n');
      initial.password = '';
    }
    if (LISTING_TYPES_WITH_MEDIA.includes(selectedType)) {
      initial.mediaFiles = mediaFilesFromItem(item);
    }
    setFormData(initial);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Kaydı sil',
      `"${getItemTitle(selectedType, item)}" silinsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(apiUrl(`/api/admin/${selectedType}/${item._id}`), { method: 'DELETE' });
              if (res.ok) fetchList();
              else {
                const d = await res.json();
                Alert.alert('Hata', d.error || 'Silinemedi');
              }
            } catch (e) {
              Alert.alert('Hata', 'Bağlantı hatası');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    const fields = FIELD_CONFIG[selectedType] || [];
    let payload = { ...formData };
    if (selectedType === 'isletme') {
      const licenseExpiryVal = (formData.licenseExpiry != null ? String(formData.licenseExpiry) : '').trim();
      payload = {
        businessName: payload.businessName,
        password: payload.password,
        phone: payload.phone,
        activityField: payload.activityField,
        address: {
          city: payload.addressCity || 'Muğla',
          district: payload.addressDistrict || '',
          neighborhood: payload.addressNeighborhood || '',
        },
        openingHours: {
          weekdays: { open: payload.weekdaysOpen || 'Kapalı', close: payload.weekdaysClose || '' },
          weekend: { open: payload.weekendOpen || 'Kapalı', close: payload.weekendClose || '' },
        },
        googleLocation: payload.googleLocation,
        mediaFiles: Array.isArray(formData.mediaFiles) ? formData.mediaFiles : [],
        googleReviewLink: payload.googleReviewLink,
        website: payload.website,
        instagram: payload.instagram,
        hasChargingStation: !!payload.hasChargingStation,
        hasFreeParking: !!payload.hasFreeParking,
        hasFreeValet: !!payload.hasFreeValet,
        hasPaidParking: !!payload.hasPaidParking,
        hasPaidValet: !!payload.hasPaidValet,
        licenseExpiry: licenseExpiryVal,
        limanCikisSaati: (payload.limanCikisSaati != null ? String(payload.limanCikisSaati) : '').trim(),
        limanGelisSaati: (payload.limanGelisSaati != null ? String(payload.limanGelisSaati) : '').trim(),
        premium: !!formData.premium,
      };
      if (payload.activityField === 'tekne_turu') {
        payload.openingHours = {
          weekdays: { open: 'Kapalı', close: '' },
          weekend: { open: 'Kapalı', close: '' },
        };
      } else {
        payload.limanCikisSaati = '';
        payload.limanGelisSaati = '';
      }
      if (modalMode === 'add' && !payload.password) payload.password = 'default123';
      if (modalMode === 'edit' && (!payload.password || payload.password.length < 6)) delete payload.password;
    } else if (selectedType === 'yoresel_etkinlik') {
      const districtTrim = (formData.addressDistrict || '').trim();
      if (!districtTrim) {
        Alert.alert('Uyarı', 'İlçe seçin.');
        return;
      }
      const hasTag =
        !!formData.serviceMuzisyen
        || !!formData.serviceAsci
        || !!formData.serviceSusleme
        || !!formData.serviceZurna
        || !!formData.serviceParkSalon
        || !!formData.serviceMekan
        || !!formData.serviceKuafor
        || !!formData.serviceAracKiralama;
      if (!hasTag) {
        Alert.alert('Uyarı', 'En az bir hizmet alanı işaretleyin.');
        return;
      }
      const hasSlot = !!formData.offeredGunduz || !!formData.offeredAksam || !!formData.offeredTamGun;
      if (!hasSlot) {
        Alert.alert('Uyarı', 'En az bir rezervasyon dilimi işaretleyin (Gündüz / Akşam / Tam gün).');
        return;
      }
      const pwd = (formData.password || '').trim();
      if (modalMode === 'add' && pwd.length < 6) {
        Alert.alert('Uyarı', 'Şifre en az 6 karakter olmalı.');
        return;
      }
      if (modalMode === 'edit' && pwd && pwd.length < 6) {
        Alert.alert('Uyarı', 'Şifre en az 6 karakter olmalı.');
        return;
      }

      const multiGroupEdit =
        modalMode === 'edit' && editingItem && String(editingItem.loginGroupId || '').trim();
      const multi = (modalMode === 'add' && formData.multiOperator === true) || !!multiGroupEdit;
      if (multi) {
        const loginNameTrim = (formData.loginName || '').trim();
        const venueLines = String(formData.venueNamesText || '')
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        const mahLinesRaw = String(formData.venueMahalleText || '').split(/\r?\n/);
        const mahLines = mahLinesRaw.map((s) => s.trim());
        const mahHasAny = mahLines.some((l) => l.length > 0);
        if (!loginNameTrim) {
          Alert.alert('Uyarı', 'Giriş kullanıcı adı girin.');
          return;
        }
        if (venueLines.length < 2) {
          Alert.alert('Uyarı', 'Birden fazla mekan için en az iki satır mekan adı yazın.');
          return;
        }
        if (new Set(venueLines).size !== venueLines.length) {
          Alert.alert('Uyarı', 'Mekan adları tekrar etmemeli (her satır benzersiz olmalı).');
          return;
        }
        if (!mahHasAny) {
          Alert.alert('Uyarı', 'Mahalle girin: tek satırda ortak mahalle veya her mekan için bir satır.');
          return;
        }
        const singleMahalleMode = mahLines.length === 1 || (mahHasAny && mahLines.filter((l) => l).length === 1);
        if (!singleMahalleMode && mahLines.length !== venueLines.length) {
          Alert.alert(
            'Uyarı',
            'Mahalle satır sayısı mekan adlarıyla aynı olmalı, ya da tek satırda ortak mahalle yazın.'
          );
          return;
        }
        if (!singleMahalleMode) {
          for (let mi = 0; mi < mahLines.length; mi += 1) {
            if (!mahLines[mi]) {
              Alert.alert('Uyarı', 'Çoklu mahalle satırlarının tamamı dolu olmalı.');
              return;
            }
          }
        }
        payload = {
          multiOperator: true,
          loginName: loginNameTrim,
          venueNamesText: venueLines.join('\n'),
          venueMahalleText: String(formData.venueMahalleText || ''),
          password: pwd,
          phone: digitsOnly(formData.phone || ''),
          description: (formData.description || '').trim(),
          addressCity: '',
          addressDistrict: districtTrim,
          addressNeighborhood: '',
          serviceMuzisyen: !!formData.serviceMuzisyen,
          serviceAsci: !!formData.serviceAsci,
          serviceSusleme: !!formData.serviceSusleme,
          serviceZurna: !!formData.serviceZurna,
          serviceParkSalon: !!formData.serviceParkSalon,
          serviceMekan: !!formData.serviceMekan,
          serviceKuafor: !!formData.serviceKuafor,
          serviceAracKiralama: !!formData.serviceAracKiralama,
          offeredGunduz: !!formData.offeredGunduz,
          offeredAksam: !!formData.offeredAksam,
          offeredTamGun: !!formData.offeredTamGun,
          mediaFiles: Array.isArray(formData.mediaFiles) ? formData.mediaFiles : [],
          licenseExpiry: (formData.licenseExpiry != null ? String(formData.licenseExpiry) : '').trim(),
          premium: !!formData.premium,
        };
        if (modalMode === 'edit' && !payload.password) delete payload.password;
      } else {
        let addressNeighborhoodOut = '';
        if (modalMode === 'edit' && editingItem) {
          addressNeighborhoodOut = String(editingItem.address?.neighborhood ?? '').trim();
        }
        payload = {
          multiOperator: false,
          name: (formData.name || '').trim(),
          password: pwd,
          phone: digitsOnly(formData.phone || ''),
          description: (formData.description || '').trim(),
          addressCity: '',
          addressDistrict: districtTrim,
          addressNeighborhood: addressNeighborhoodOut,
          serviceMuzisyen: !!formData.serviceMuzisyen,
          serviceAsci: !!formData.serviceAsci,
          serviceSusleme: !!formData.serviceSusleme,
          serviceZurna: !!formData.serviceZurna,
          serviceParkSalon: !!formData.serviceParkSalon,
          serviceMekan: !!formData.serviceMekan,
          serviceKuafor: !!formData.serviceKuafor,
          serviceAracKiralama: !!formData.serviceAracKiralama,
          offeredGunduz: !!formData.offeredGunduz,
          offeredAksam: !!formData.offeredAksam,
          offeredTamGun: !!formData.offeredTamGun,
          mediaFiles: Array.isArray(formData.mediaFiles) ? formData.mediaFiles : [],
          licenseExpiry: (formData.licenseExpiry != null ? String(formData.licenseExpiry) : '').trim(),
          premium: !!formData.premium,
        };
        if (modalMode === 'add' && !payload.name) {
          Alert.alert('Uyarı', 'İşletme adı girin.');
          return;
        }
        if (modalMode === 'edit' && !payload.password) delete payload.password;
      }
    } else if (selectedType === 'uye_indirimi') {
      payload = {
        memberId: (formData.memberId || '').trim(),
        business: formData.business,
        title: (formData.title || '').trim(),
        description: (formData.description || '').trim(),
        discountPercent: (formData.discountPercent || '').trim(),
        validUntil: (formData.validUntil || '').trim(),
        active: formData.active !== false,
        note: (formData.note || '').trim(),
      };
      if (!payload.memberId) {
        Alert.alert('Uyarı', 'Üye numarası girin (kullanıcı profilinden).');
        return;
      }
      if (!payload.business) {
        Alert.alert('Uyarı', 'İşletme seçin.');
        return;
      }
    } else if (selectedType === 'kampanyalar') {
      payload = {
        title: (formData.title || '').trim(),
        description: '',
        companyName: (formData.companyName || '').trim(),
        contactPhone: (formData.contactPhone || '').trim(),
        discountText: (formData.discountText || '').trim(),
        addressCity: (formData.addressCity || '').trim() || DEFAULT_CITY,
        addressDistrict: (formData.addressDistrict || '').trim(),
        addressNeighborhood: (formData.addressNeighborhood || '').trim(),
        startDate: (formData.startDate || '').trim(),
        endDate: '',
        imageUrl: (formData.imageUrl || '').trim(),
        licenseExpiry: (formData.licenseExpiry != null ? String(formData.licenseExpiry) : '').trim(),
      };
      if (formData.business) payload.business = formData.business;
    } else if (['esnaf', 'cekici', 'lastikci', 'taksi'].includes(selectedType)) {
      payload = {
        ...formData,
        mediaFiles: Array.isArray(formData.mediaFiles) ? formData.mediaFiles : [],
        openingHours: {
          weekdays: { open: formData.weekdaysOpen || 'Kapalı', close: formData.weekdaysClose || '' },
          weekend: { open: formData.weekendOpen || 'Kapalı', close: formData.weekendClose || '' },
        },
      };
      delete payload.weekdaysOpen;
      delete payload.weekdaysClose;
      delete payload.weekendOpen;
      delete payload.weekendClose;
      delete payload.menuPdfUrl;
      delete payload.menuImageUrl;
      delete payload.imageUrl;
      payload.premium = !!formData.premium;
      const pwd = (formData.password || '').trim();
      if (formData.premium && modalMode === 'add' && pwd.length < 6) {
        Alert.alert('Uyarı', 'Premium için giriş şifresi en az 6 karakter olmalı.');
        return;
      }
      if (formData.premium && modalMode === 'edit' && pwd && pwd.length < 6) {
        Alert.alert('Uyarı', 'Premium şifresi en az 6 karakter olmalı.');
        return;
      }
      if (modalMode === 'edit' && !pwd) delete payload.password;
      Object.keys(payload).forEach((key) => {
        if (payload[key] === '') delete payload[key];
      });
    } else {
      const LISTING_PREMIUM_TYPES = ['esnaf', 'cekici', 'lastikci', 'taksi'];
      if (LISTING_PREMIUM_TYPES.includes(selectedType)) {
        payload.premium = !!formData.premium;
        const pwd = (formData.password || '').trim();
        if (formData.premium && modalMode === 'add' && pwd.length < 6) {
          Alert.alert('Uyarı', 'Premium için giriş şifresi en az 6 karakter olmalı.');
          return;
        }
        if (formData.premium && modalMode === 'edit' && pwd && pwd.length < 6) {
          Alert.alert('Uyarı', 'Premium şifresi en az 6 karakter olmalı.');
          return;
        }
        if (modalMode === 'edit' && !pwd) delete payload.password;
      }
      fields.forEach((f) => {
        if (payload[f.name] === '') delete payload[f.name];
      });
    }

    if (ADMIN_TYPES_WITH_LICENSE_EXPIRY.includes(selectedType)) {
      const lic =
        payload.licenseExpiry !== undefined && payload.licenseExpiry !== null
          ? String(payload.licenseExpiry)
          : formData.licenseExpiry != null
            ? String(formData.licenseExpiry)
            : '';
      const licErr = errorIfLicenseExpiryBeforeToday(lic.trim());
      if (licErr) {
        Alert.alert('Geçersiz tarih', licErr);
        return;
      }
    }

    if (modalMode === 'edit' && editingItem) {
      try {
        const res = await fetch(apiUrl(`/api/admin/${selectedType}/${editingItem._id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setModalVisible(false);
          setDatePickerField(null);
          setLimanTimePickerField(null);
          fetchList();
        } else Alert.alert('Hata', data.error || 'Güncellenemedi');
      } catch (e) {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
    } else {
      try {
        const res = await fetch(apiUrl(`/api/admin/${selectedType}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setModalVisible(false);
          setDatePickerField(null);
          setLimanTimePickerField(null);
          fetchList();
        } else {
          Alert.alert('Hata', data.message ? `${data.error || 'Eklenemedi'}\n${data.message}` : (data.error || 'Eklenemedi'));
        }
      } catch (e) {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
    }
  };

  const fields = FIELD_CONFIG[selectedType] || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pageTopRow}>
        <TouchableOpacity style={styles.kullanicilarBtn} onPress={() => navigation.navigate('AdminUsers')}>
          <Text style={styles.kullanicilarBtnText}>Kullanıcılar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.kullaniciAdresBtn}
          onPress={() => navigation.navigate('AdminUsersByAddress')}
        >
          <Text style={styles.kullaniciAdresBtnText}>Kullanıcı adresleri</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bekleyenBtn} onPress={() => navigation.navigate('BekleyenKayitlar')}>
          <Text style={styles.bekleyenBtnText}>Bekleyen kayıtlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.lisansBtn} onPress={() => navigation.navigate('LisansBitmekUzere')}>
          <Text style={styles.lisansBtnText}>Lisansı bitmek üzere</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.homePhotoSmallBtn}
        onPress={() => setHomePhotoModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.homePhotoSmallBtnText}>🖼 Ana sayfa fotoğrafı</Text>
      </TouchableOpacity>

      <Modal
        visible={homePhotoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHomePhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.homePhotoModalOverlay}
          activeOpacity={1}
          onPress={() => setHomePhotoModalVisible(false)}
        >
          <View style={styles.homePhotoModalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.homePhotoModalTitle}>Ana sayfa fotoğrafı (giriş ekranı)</Text>
            {homeImageUrl ? (
              <Image source={{ uri: apiUrl(homeImageUrl) }} style={styles.homePhotoPreview} resizeMode="cover" />
            ) : null}
            <TextInput
              style={styles.homePhotoInput}
              value={homeImageUrl}
              onChangeText={setHomeImageUrl}
              placeholder="Fotoğraf URL veya galeriden yükle"
              placeholderTextColor="#999"
            />
            <View style={styles.homePhotoButtons}>
              <TouchableOpacity
                style={[styles.homePhotoUploadBtn, homeImageUploading && styles.homePhotoBtnDisabled]}
                onPress={uploadHomeImage}
                disabled={homeImageUploading}
              >
                {homeImageUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.homePhotoUploadBtnText}>Galeriden seç & yükle</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.homePhotoSaveBtn, homeImageSaving && styles.homePhotoBtnDisabled]}
                onPress={saveHomeImage}
                disabled={homeImageSaving}
              >
                {homeImageSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.homePhotoSaveBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.homePhotoModalClose}
              onPress={() => setHomePhotoModalVisible(false)}
            >
              <Text style={styles.homePhotoModalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Text style={styles.sectionLabel}>Liste türü</Text>
      <ScrollView
        style={styles.typeScrollWrap}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {ADMIN_GROUPS.map((gr) => {
          const typesInGroup = gr.keys.map((k) => LIST_TYPES.find((t) => t.key === k)).filter(Boolean);
          return (
            <View key={gr.title} style={styles.typeGroup}>
              <Text style={styles.typeGroupTitle}>{gr.title}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeScroll}
                contentContainerStyle={styles.typeScrollContent}
                nestedScrollEnabled
              >
                {typesInGroup.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeChip, selectedType === t.key && styles.typeChipActive]}
                    onPress={() => {
                      setAddressPickerType(null);
                      setAddressPickerTarget('form');
                      setModalVisible(false);
                      setLimanTimePickerField(null);
                      setSelectedType(t.key);
                    }}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    delayPressOut={0}
                  >
                    <Text style={[styles.typeChipText, selectedType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {selectedType === 'isletme' ? (
        <>
          <Text style={styles.activityFilterLabel}>Faaliyet alanı</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activityFilterScrollHorizontal}
            contentContainerStyle={styles.activityFilterContent}
            nestedScrollEnabled
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id || 'tumu'}
                style={[styles.activityChip, styles.activityChipNoShrink, activityFieldFilter === opt.id && styles.activityChipActive]}
                onPress={() => {
                  setActivityFieldFilter(opt.id);
                  fetchList(opt.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.activityChipText, activityFieldFilter === opt.id && styles.activityChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.hintTextCompact}>Uygulama ile üye olan işletmeler de bu listede görünür.</Text>
        </>
      ) : null}

      {selectedType === 'esnaf' ? (
        <>
          <Text style={styles.activityFilterLabel}>Kategori</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            style={styles.activityFilterScrollHorizontal}
            contentContainerStyle={styles.activityFilterContent}
            nestedScrollEnabled
          >
            {ESNAF_CATEGORY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id || 'tumu'}
                style={[styles.activityChip, esnafCategoryFilter === opt.id && styles.activityChipActive]}
                onPress={() => {
                  setEsnafCategoryFilter(opt.id);
                  fetchList(undefined, opt.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.activityChipText, esnafCategoryFilter === opt.id && styles.activityChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      {selectedType === 'yoresel_etkinlik' ? (
        <>
          <Text style={styles.activityFilterLabel}>Hizmet alanı (alt grup)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            style={styles.activityFilterScrollHorizontal}
            contentContainerStyle={styles.activityFilterContent}
            nestedScrollEnabled
          >
            {YORESEL_SERVICE_FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id || 'tumu'}
                style={[styles.activityChip, yoreselServiceTagFilter === opt.id && styles.activityChipActive]}
                onPress={() => {
                  setYoreselServiceTagFilter(opt.id);
                  fetchList(undefined, undefined, opt.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.activityChipText,
                    yoreselServiceTagFilter === opt.id && styles.activityChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.hintText}>
            «Tümü» tüm kayıtları listeler; bir alt grup seçildiğinde yalnızca o hizmeti sunan işletmeler görünür.
          </Text>
        </>
      ) : null}

      <Text style={styles.activityFilterLabel}>Liste adres filtresi (ilçe, mahalle)</Text>
      <View style={styles.listAddressFilterRow}>
        <TouchableOpacity style={styles.listAddressFilterChip} onPress={() => openListAddressPicker('district')} activeOpacity={0.75}>
          <Text style={styles.listAddressFilterLabel}>İlçe</Text>
          <Text style={styles.listAddressFilterValue} numberOfLines={1}>{listFilterDistrict || 'Tümü'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listAddressFilterChip} onPress={() => openListAddressPicker('neighborhood')} activeOpacity={0.75}>
          <Text style={styles.listAddressFilterLabel}>Mahalle</Text>
          <Text style={styles.listAddressFilterValue} numberOfLines={1}>{listFilterNeighborhood || 'Tümü'}</Text>
        </TouchableOpacity>
      </View>
      {(listFilterDistrict || listFilterNeighborhood) ? (
        <TouchableOpacity
          style={styles.listAddressClearBtn}
          onPress={() => {
            setListFilterDistrict('');
            setListFilterNeighborhood('');
          }}
        >
          <Text style={styles.listAddressClearBtnText}>İlçe / mahalle filtresini temizle</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.listeleBtn} onPress={onListele} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.listeleBtnText}>Listele</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.ekleBtn} onPress={openAdd}>
          <Text style={styles.ekleBtnText}>Ekle</Text>
        </TouchableOpacity>
      </View>

      {listError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{listError}</Text>
          <Text style={styles.errorHint}>Backend: cd backend && npm start{'\n'}MongoDB bağlı mı kontrol edin.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchList}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        style={styles.adminList}
        data={list}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />}
        ListEmptyComponent={
          !loading && list.length === 0 && !listError ? (
            <Text style={styles.emptyText}>Liste boş. "Listele" ile getir veya "Ekle" ile yeni kayıt ekle.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{getItemTitle(selectedType, item)}</Text>
              {item.phone ? <Text style={styles.rowSub}>{item.phone}</Text> : null}
              {selectedType === 'yoresel_etkinlik' && item.address?.district ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  İlçe: {item.address.district}
                </Text>
              ) : null}
              {selectedType === 'yoresel_etkinlik' && item.address?.neighborhood ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  Mahalle: {item.address.neighborhood}
                </Text>
              ) : null}
              {item.licenseExpiry ? (
                <Text style={styles.rowSub}>
                  {selectedType === 'kampanyalar' ? 'Kampanya bitiş tarihi' : 'Lisans bitiş'}: {item.licenseExpiry}
                </Text>
              ) : null}
              {selectedType === 'kampanyalar' && (item.companyName || item.business?.businessName) ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  İşletme: {item.companyName || item.business?.businessName}
                </Text>
              ) : null}
              {selectedType === 'uye_indirimi' && item.memberId ? (
                <Text style={styles.rowSub}>Üye no: {item.memberId}</Text>
              ) : null}
              {selectedType === 'uye_indirimi' && item.business?.businessName ? (
                <Text style={styles.rowSub}>İşletme: {item.business.businessName}</Text>
              ) : null}
              {selectedType === 'uye_indirimi' && item.discountPercent != null ? (
                <Text style={styles.rowSub}>İndirim: %{item.discountPercent}</Text>
              ) : null}
              {selectedType === 'uye_indirimi' && item.validUntil ? (
                <Text style={styles.rowSub}>Bitiş: {item.validUntil}</Text>
              ) : null}
              {selectedType === 'uye_indirimi' && item.active === false ? (
                <Text style={styles.rowSub}>Pasif</Text>
              ) : null}
              {selectedType === 'kampanyalar' && item.contactPhone ? (
                <Text style={styles.rowSub} numberOfLines={1}>{item.contactPhone}</Text>
              ) : null}
              {selectedType === 'yoresel_etkinlik' && Array.isArray(item.serviceTags) && item.serviceTags.length > 0 ? (
                <Text style={styles.rowSub} numberOfLines={2}>
                  Hizmetler:{' '}
                  {item.serviceTags.map((t) => YORESEL_TAG_LABELS[t] || t).join(' · ')}
                </Text>
              ) : null}
              {selectedType === 'yoresel_etkinlik' && Array.isArray(item.offeredTimeSlots) && item.offeredTimeSlots.length > 0 ? (
                <Text style={styles.rowSub} numberOfLines={2}>
                  Dilimler:{' '}
                  {item.offeredTimeSlots.map((s) => yoreselTimeSlotLabel(s)).join(' · ')}
                </Text>
              ) : null}
              {selectedType === 'yoresel_etkinlik' && item.loginGroupId ? (
                <Text style={styles.rowSub}>Çoklu mekan (ortak giriş)</Text>
              ) : null}
              {selectedType === 'yoresel_etkinlik' && item.loginName ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  Giriş kullanıcı adı: {item.loginName}
                </Text>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.updateBtn} onPress={() => openEdit(item)}>
                <Text style={styles.updateBtnText}>Güncelle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtnText}>Çıkar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Tek modal: hem form hem il/ilçe/mahalle seçici (çift modal donmasını önler) */}
      <Modal
        visible={modalVisible || addressPickerType != null}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (limanTimePickerField != null) setLimanTimePickerField(null);
          else if (datePickerField != null) setDatePickerField(null);
          else if (addressPickerType != null) {
            setAddressPickerType(null);
            setAddressPickerTarget('form');
          } else if (selectModalField != null) setSelectModalField(null);
          else setModalVisible(false);
        }}
      >
        <View style={[styles.modalOverlay, addressPickerType != null && styles.modalOverlayBottom]}>
          {addressPickerType != null ? (
            <>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setAddressPickerType(null);
                  setAddressPickerTarget('form');
                }}
              />
              <View style={styles.pickerBox}>
                <Text style={styles.pickerTitle}>
                  {addressPickerTarget === 'list' ? 'Liste filtresi — ' : ''}
                  {addressPickerType === 'city' ? 'İl seçin' : addressPickerType === 'district' ? 'İlçe seçin' : 'Mahalle seçin'}
                </Text>
                {addressPickerTarget === 'list' && addressPickerType === 'neighborhood' && listFilterNhoodLoading ? (
                  <View style={styles.pickerLoading}><ActivityIndicator size="small" color="#34C759" /><Text style={styles.pickerLoadingText}>Yükleniyor...</Text></View>
                ) : addressPickerTarget === 'form' && addressPickerLoading ? (
                  <View style={styles.pickerLoading}><ActivityIndicator size="small" color="#34C759" /><Text style={styles.pickerLoadingText}>Yükleniyor...</Text></View>
                ) : (
                  <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
                    {addressPickerType === 'city' && (provinces.length > 0 ? provinces : [{ id: 'mugla', name: DEFAULT_CITY }]).map((p) => (
                      <TouchableOpacity
                        key={p.id || p.name}
                        style={styles.pickerItem}
                        onPress={() => {
                          setFormData((prev) => ({ ...prev, addressCity: p.name, addressDistrict: '', addressNeighborhood: '' }));
                          setAddressPickerType(null);
                          setAddressPickerTarget('form');
                        }}
                      >
                        <Text style={styles.pickerItemText}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {addressPickerType === 'district' && (districtsList.length > 0 ? districtsList : MUGLA_DISTRICTS_FALLBACK.map((name) => ({ id: name, name }))).map((d) => (
                      <TouchableOpacity
                        key={d.id || d.name}
                        style={styles.pickerItem}
                        onPress={() => {
                          if (addressPickerTarget === 'list') {
                            setListFilterDistrict(d.name);
                            setListFilterNeighborhood('');
                          } else {
                            setFormData((prev) => ({ ...prev, addressDistrict: d.name, addressNeighborhood: '' }));
                          }
                          setAddressPickerType(null);
                          setAddressPickerTarget('form');
                        }}
                      >
                        <Text style={styles.pickerItemText}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {addressPickerType === 'neighborhood' && (
                      (addressPickerTarget === 'list' ? listFilterNeighborhoodsList : neighborhoodsList).length > 0
                        ? (addressPickerTarget === 'list' ? listFilterNeighborhoodsList : neighborhoodsList).map((n) => (
                          <TouchableOpacity
                            key={n.id || n.name}
                            style={styles.pickerItem}
                            onPress={() => {
                              if (addressPickerTarget === 'list') {
                                setListFilterNeighborhood(n.name);
                              } else {
                                setFormData((prev) => ({ ...prev, addressNeighborhood: n.name }));
                              }
                              setAddressPickerType(null);
                              setAddressPickerTarget('form');
                            }}
                          >
                            <Text style={styles.pickerItemText}>{n.name}</Text>
                          </TouchableOpacity>
                        ))
                        : <Text style={styles.pickerEmptyText}>Bu ilçede mahalle listesi bulunamadı veya henüz yüklenmedi.</Text>
                    )}
                  </ScrollView>
                )}
                <TouchableOpacity
                  style={styles.pickerClose}
                  onPress={() => {
                    setAddressPickerType(null);
                    setAddressPickerTarget('form');
                  }}
                >
                  <Text style={styles.pickerCloseText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : modalVisible ? (
            <KeyboardAvoidingView
              style={styles.modalKeyboardRoot}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            >
              <Pressable
                style={styles.modalBackdropPressable}
                onPress={() => {
                  setModalVisible(false);
                  setDatePickerField(null);
                  setSelectModalField(null);
                  setLimanTimePickerField(null);
                }}
              />
              <View style={styles.modalOverlayCenter} pointerEvents="box-none">
                <View style={styles.modalBox} pointerEvents="auto">
                  {selectModalField ? (
                    <>
                      <Text style={styles.modalTitle} numberOfLines={2}>
                        {selectModalField === '__business__'
                          ? 'İşletme — listeden seçin'
                          : `${(fields.find((fld) => fld.name === selectModalField)?.label || 'Seçim')} — listeden seçin`}
                      </Text>
                      <ScrollView style={styles.categoryPickerScroll} keyboardShouldPersistTaps="always" nestedScrollEnabled>
                        {(selectModalField === '__business__'
                          ? businessPickerOptions
                          : (fields.find((f) => f.name === selectModalField)?.options || [])
                        ).map((opt, optIdx) => (
                          <TouchableOpacity
                            key={`${selectModalField}-${optIdx}-${String(opt.id)}`}
                            style={styles.selectModalItem}
                            onPress={() => {
                              if (selectModalField === '__business__') {
                                setFormData((prev) => ({ ...prev, business: opt.id }));
                                setSelectModalField(null);
                                return;
                              }
                              setFormData((prev) => {
                                const next = { ...prev, [selectModalField]: opt.id };
                                if (selectModalField === 'activityField') {
                                  if (opt.id === 'tekne_turu') {
                                    if (!next.limanCikisSaati) next.limanCikisSaati = '09:00';
                                    if (!next.limanGelisSaati) next.limanGelisSaati = '18:00';
                                    next.weekdaysOpen = 'Kapalı';
                                    next.weekdaysClose = '';
                                    next.weekendOpen = 'Kapalı';
                                    next.weekendClose = '';
                                  } else {
                                    next.limanCikisSaati = '';
                                    next.limanGelisSaati = '';
                                  }
                                }
                                return next;
                              });
                              setSelectModalField(null);
                            }}
                          >
                            <Text style={styles.selectModalItemText}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <TouchableOpacity style={styles.categoryPickerBack} onPress={() => setSelectModalField(null)}>
                        <Text style={styles.categoryPickerBackText}>← Forma dön</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                  <Text style={styles.modalTitle}>{modalMode === 'add' ? 'Yeni ekle' : 'Güncelle'}</Text>
                  {selectedType === 'yoresel_etkinlik' && modalMode === 'edit' && editingItem?.loginGroupId ? (
                    <Text style={styles.multiGroupEditHint}>
                      Çoklu mekan grubu: tüm mekan adları ve ortak bilgiler birlikte güncellenir.
                    </Text>
                  ) : null}
                  <ScrollView
                    style={styles.formScroll}
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {fields.map((f) => {
                      if (f.addOnly && modalMode !== 'add') return null;
                      if (typeof f.showIf === 'function' && !f.showIf(formData)) return null;
                      const isAddressField = (selectedType === 'isletme' || selectedType === 'esnaf' || selectedType === 'yoresel_etkinlik' || selectedType === 'cekici' || selectedType === 'lastikci' || selectedType === 'kampanyalar' || selectedType === 'duyurular' || selectedType === 'isilanlari' || selectedType === 'taksi') &&
                        (f.name === 'addressCity' || f.name === 'addressDistrict' || f.name === 'addressNeighborhood');
                      if (f.type === 'businessPicker') {
                        const selectedBiz = businessPickerOptions.find((o) => o.id === formData.business);
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}{f.required && modalMode === 'add' ? ' *' : ''}</Text>
                            <TouchableOpacity
                              style={styles.selectTouch}
                              onPress={() => {
                                if (businessPickerOptions.length === 0) loadBusinessPickerOptions();
                                setSelectModalField('__business__');
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectTouchText, !selectedBiz && styles.selectTouchPlaceholder]}>
                                {selectedBiz ? selectedBiz.label : 'İşletme seçin'}
                              </Text>
                              <Text style={styles.selectTouchArrow}>▼</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      if (f.type === 'checkbox') {
                        const multiGroupLock =
                          selectedType === 'yoresel_etkinlik'
                          && f.name === 'multiOperator'
                          && modalMode === 'edit'
                          && editingItem?.loginGroupId;
                        return (
                          <TouchableOpacity
                            key={f.name}
                            style={styles.checkboxRow}
                            onPress={() => {
                              if (multiGroupLock) return;
                              setFormData((prev) => ({ ...prev, [f.name]: !prev[f.name] }));
                            }}
                            activeOpacity={multiGroupLock ? 1 : 0.7}
                          >
                            <View style={[styles.checkbox, formData[f.name] && styles.checkboxChecked]}>
                              {formData[f.name] ? <Text style={styles.checkboxTick}>✓</Text> : null}
                            </View>
                            <Text style={styles.checkboxLabel}>{f.label}</Text>
                          </TouchableOpacity>
                        );
                      }
                      if (f.type === 'mediaFiles') {
                        return (
                          <View key={f.name} style={styles.field}>
                            <ListingMediaFormField
                              value={Array.isArray(formData.mediaFiles) ? formData.mediaFiles : []}
                              onChange={(next) => setFormData((prev) => ({ ...prev, mediaFiles: next }))}
                              label={f.label}
                            />
                          </View>
                        );
                      }
                      if (f.type === 'image') {
                        const imgUrl = formData[f.name];
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}</Text>
                            {imgUrl ? (
                              <Image source={{ uri: apiUrl(imgUrl) }} style={styles.formImageThumb} resizeMode="cover" />
                            ) : null}
                            <TextInput
                              style={styles.input}
                              value={imgUrl || ''}
                              onChangeText={(text) => setFormData((prev) => ({ ...prev, [f.name]: text }))}
                              placeholder="Fotoğraf URL (yükle veya yapıştır)"
                              placeholderTextColor="#999"
                            />
                            <TouchableOpacity
                              style={[styles.uploadImageBtn, imageUploading && styles.uploadImageBtnDisabled]}
                              onPress={pickAndUploadImage}
                              disabled={imageUploading}
                            >
                              {imageUploading ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={styles.uploadImageBtnText}>Galeriden fotoğraf seç & yükle</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      if (isAddressField) {
                        const pickerType = f.name === 'addressCity' ? 'city' : f.name === 'addressDistrict' ? 'district' : 'neighborhood';
                        const value = formData[f.name] || '';
                        const label = f.name === 'addressCity' ? 'İl seçin' : f.name === 'addressDistrict' ? 'İlçe seçin' : 'Mahalle seçin';
                        const reqStar = f.required && modalMode === 'add' ? ' *' : '';
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}{reqStar}</Text>
                            <TouchableOpacity
                              style={styles.selectTouch}
                              onPress={() => openAddressPicker(pickerType)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectTouchText, !value && styles.selectTouchPlaceholder]}>
                                {value || label}
                              </Text>
                              <Text style={styles.selectTouchArrow}>▼</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      if (f.type === 'date') {
                        const dateStr = formData[f.name] || '';
                        const displayVal = dateStr || 'Tarih seçin';
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}{f.required && modalMode === 'add' ? ' *' : ''}</Text>
                            <TouchableOpacity
                              style={styles.selectTouch}
                              onPress={() => {
                                let base = parseDateStr(dateStr);
                                if (f.name === 'licenseExpiry') base = dateNotBeforeToday(base);
                                setDatePickerTemp(base);
                                setDatePickerField(f.name);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectTouchText, !dateStr && styles.selectTouchPlaceholder]}>
                                {displayVal}
                              </Text>
                              <Text style={styles.selectTouchArrow}>📅</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      if (f.type === 'limanTime') {
                        const rawL = formData[f.name];
                        const vL = rawL === undefined || rawL === null ? '' : String(rawL);
                        const inList = LIMAN_UYE_SAAT_SECENEKLERI.includes(vL);
                        const displayL = inList ? vL : vL ? vL : 'Saat seçin';
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}{f.required && modalMode === 'add' ? ' *' : ''}</Text>
                            <TouchableOpacity
                              style={styles.selectTouch}
                              onPress={() => {
                                setDatePickerField(null);
                                setLimanTimePickerField(f.name);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectTouchText, !inList && !vL && styles.selectTouchPlaceholder]}>
                                {displayL}
                              </Text>
                              <Text style={styles.selectTouchArrow}>▼</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      if (f.type === 'textarea') {
                        const taPlaceholder =
                          f.name === 'venueMahalleText'
                            ? 'Örn. tek satır: Ortak Mahalle — veya her satırda bir mekanın mahallesi'
                            : 'Her satıra bir mekan adı';
                        const taReq = f.required && modalMode === 'add' ? ' *' : '';
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}{taReq}</Text>
                            <TextInput
                              style={[styles.input, styles.textareaInput]}
                              value={formData[f.name] || ''}
                              onChangeText={(text) => setFormData((prev) => ({ ...prev, [f.name]: text }))}
                              placeholder={taPlaceholder}
                              placeholderTextColor="#999"
                              multiline
                              textAlignVertical="top"
                            />
                          </View>
                        );
                      }
                      if (f.type === 'select' && Array.isArray(f.options)) {
                        const rawSel = formData[f.name];
                        const value = rawSel === undefined || rawSel === null ? '' : String(rawSel);
                        const selOpt = f.options.find((o) => o.id === value);
                        const displayLabel = selOpt != null ? selOpt.label : value || 'Seçin';
                        return (
                          <View key={f.name} style={styles.field}>
                            <Text style={styles.fieldLabel}>{f.label}{f.required && modalMode === 'add' ? ' *' : ''}</Text>
                            <TouchableOpacity
                              style={styles.selectTouch}
                              onPress={() => setSelectModalField(f.name)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectTouchText, selOpt == null && styles.selectTouchPlaceholder]}>
                                {displayLabel}
                              </Text>
                              <Text style={styles.selectTouchArrow}>▼</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      {
                        const isPhoneField = f.name === 'phone' || f.name === 'contactPhone';
                        return (
                        <View key={f.name} style={styles.field}>
                          <Text style={styles.fieldLabel}>{f.label}{f.required && modalMode === 'add' ? ' *' : ''}</Text>
                          <TextInput
                            style={styles.input}
                            value={formData[f.name] || ''}
                            onChangeText={(text) => {
                              let v = isPhoneField ? digitsOnly(text) : text;
                              if (selectedType === 'uye_indirimi' && f.name === 'memberId') {
                                v = text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
                              }
                              setFormData((prev) => ({ ...prev, [f.name]: v }));
                            }}
                            placeholder={f.placeholder || f.label}
                            placeholderTextColor="#999"
                            secureTextEntry={f.name === 'password'}
                            keyboardType={
                              isPhoneField || f.keyboard === 'numeric' ? 'number-pad' : 'default'
                            }
                            autoCapitalize={selectedType === 'uye_indirimi' && f.name === 'memberId' ? 'characters' : 'none'}
                          />
                        </View>
                        );
                      }
                    })}
                  </ScrollView>
                  {datePickerField ? (
                    <View style={styles.datePickerWrap}>
                      <DateTimePicker
                        value={
                          Platform.OS === 'ios'
                            ? datePickerTemp
                            : datePickerField === 'licenseExpiry'
                              ? dateNotBeforeToday(parseDateStr(formData[datePickerField]))
                              : parseDateStr(formData[datePickerField])
                        }
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={datePickerField === 'licenseExpiry' ? startOfToday() : undefined}
                        onChange={(event, selectedDate) => {
                          let next = selectedDate || new Date();
                          if (datePickerField === 'licenseExpiry') next = dateNotBeforeToday(next);
                          if (Platform.OS === 'android') {
                            if (event.type === 'dismissed') {
                              setDatePickerField(null);
                              return;
                            }
                            setFormData((prev) => ({ ...prev, [datePickerField]: formatDateToStr(next) }));
                            setDatePickerField(null);
                          } else {
                            setDatePickerTemp(next);
                          }
                        }}
                        locale="tr-TR"
                      />
                      {Platform.OS === 'ios' ? (
                        <TouchableOpacity
                          style={styles.datePickerOkBtn}
                          onPress={() => {
                            const v = datePickerField === 'licenseExpiry' ? dateNotBeforeToday(datePickerTemp) : datePickerTemp;
                            setFormData((prev) => ({ ...prev, [datePickerField]: formatDateToStr(v) }));
                            setDatePickerField(null);
                          }}
                        >
                          <Text style={styles.datePickerOkText}>Tamam</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setDatePickerField(null); setSelectModalField(null); setLimanTimePickerField(null); }}>
                      <Text style={styles.cancelBtnText}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
                      <Text style={styles.saveBtnText}>{modalMode === 'add' ? 'Ekle' : 'Kaydet'}</Text>
                    </TouchableOpacity>
                  </View>
                    </>
                  )}
                  {/* Liman saatleri: ayrı Modal yerine form modalı içinde (çift Modal dokunma/z-order sorunu olmasın) */}
                  {limanTimePickerField && !selectModalField ? (
                    <View style={styles.limanTimeInlineLayer}>
                      <Pressable style={styles.limanTimeInlineDim} onPress={() => setLimanTimePickerField(null)} />
                      <View style={styles.limanTimeSheetContent} pointerEvents="auto">
                        <Text style={styles.limanTimeSheetTitle}>
                          {limanTimePickerField === 'limanCikisSaati' ? 'Liman çıkış saati' : 'Liman geliş saati'}
                        </Text>
                        <ScrollView style={styles.limanTimeSheetScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                          {LIMAN_UYE_SAAT_SECENEKLERI.map((s) => (
                            <TouchableOpacity
                              key={s}
                              style={styles.limanTimeSheetItem}
                              onPress={() => {
                                const field = limanTimePickerField;
                                if (field) {
                                  setFormData((prev) => ({ ...prev, [field]: s }));
                                }
                                setLimanTimePickerField(null);
                              }}
                            >
                              <Text style={styles.limanTimeSheetItemText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.limanTimeSheetClose} onPress={() => setLimanTimePickerField(null)}>
                          <Text style={styles.limanTimeSheetCloseText}>Kapat</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </KeyboardAvoidingView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#34C759',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', flex: 1 },
  logoutBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  kullanicilarBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#6a1b9a',
    borderRadius: 10,
    marginRight: 4,
  },
  kullanicilarBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  kullaniciAdresBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#00897b',
    borderRadius: 10,
    marginRight: 4,
  },
  kullaniciAdresBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bekleyenBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#007AFF', borderRadius: 10, marginRight: 4 },
  bekleyenBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  lisansBtn: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#e65100', borderRadius: 10 },
  lisansBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  homePhotoSmallBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  homePhotoSmallBtnText: { fontSize: 14, fontWeight: '600', color: '#333' },
  homePhotoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  homePhotoModalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  homePhotoModalTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 14 },
  homePhotoModalClose: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  homePhotoModalCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
  homePhotoPreview: { width: '100%', height: 140, borderRadius: 8, marginBottom: 10, backgroundColor: '#f0f0f0' },
  homePhotoInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  homePhotoButtons: { flexDirection: 'row' },
  homePhotoUploadBtn: { flex: 1, marginRight: 8, backgroundColor: '#34C759', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  homePhotoSaveBtn: { flex: 1, backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  homePhotoBtnDisabled: { opacity: 0.7 },
  homePhotoUploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  homePhotoSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 14, color: '#666', marginHorizontal: 20, marginTop: 10, marginBottom: 6 },
  hintText: { fontSize: 12, color: '#666', marginHorizontal: 20, marginTop: 4, marginBottom: 4 },
  hintTextCompact: { fontSize: 11, color: '#666', marginHorizontal: 16, marginTop: 2, marginBottom: 2 },
  typeScrollWrap: { maxHeight: 120 },
  typeGroup: { marginBottom: 12 },
  typeGroupTitle: { fontSize: 13, fontWeight: '700', color: '#555', marginLeft: 16, marginBottom: 6 },
  activityFilterLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginHorizontal: 16, marginTop: 6, marginBottom: 4 },
  activityFilterScrollHorizontal: {
    maxHeight: 44,
    marginBottom: 2,
  },
  activityFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 2,
  },
  activityChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  activityChipNoShrink: { flexShrink: 0 },
  adminList: { flex: 1 },
  activityChipActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
  activityChipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  activityChipTextActive: { color: '#fff' },
  listAddressFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
    alignItems: 'stretch',
  },
  listAddressFilterChip: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  listAddressFilterLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  listAddressFilterValue: { fontSize: 13, fontWeight: '600', color: '#333' },
  listAddressClearBtn: { alignSelf: 'center', marginBottom: 8, paddingVertical: 6, paddingHorizontal: 12 },
  listAddressClearBtnText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  selectModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  selectModalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '70%' },
  selectModalTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  selectModalItem: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  selectModalItemText: { fontSize: 15, color: '#333' },
  selectModalClose: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  selectModalCloseText: { fontSize: 15, fontWeight: '600', color: '#34C759' },
  typeScroll: { maxHeight: 50 },
  typeScrollContent: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  typeChipActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
  typeChipText: { fontSize: 14, color: '#333', fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  listeleBtn: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  listeleBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ekleBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ekleBtnText: { color: '#34C759', fontSize: 16, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 24, paddingHorizontal: 20 },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff0f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: { fontSize: 15, color: '#c00', fontWeight: '600', marginBottom: 8 },
  errorHint: { fontSize: 12, color: '#666', marginBottom: 12 },
  retryBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#34C759', borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  rowSub: { fontSize: 13, color: '#666', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  updateBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#34C759', borderRadius: 8 },
  updateBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#dc3545', borderRadius: 8 },
  deleteBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalOverlayBottom: { justifyContent: 'flex-end', padding: 0 },
  /** Form modal: klavye + dokunma katmanı (arka plan ile içerik çakışmasın) */
  modalKeyboardRoot: { flex: 1, width: '100%' },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: 'transparent',
  },
  modalOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: 24,
  },
  modalBox: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', padding: 20, paddingBottom: 8 },
  multiGroupEditHint: {
    fontSize: 13,
    color: '#2e6b3a',
    paddingHorizontal: 20,
    paddingBottom: 10,
    lineHeight: 18,
  },
  categoryPickerScroll: { maxHeight: 440, paddingHorizontal: 12 },
  categoryPickerBack: { paddingVertical: 14, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8e8e8' },
  categoryPickerBackText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
  formScroll: { paddingHorizontal: 20, maxHeight: 420, flexGrow: 0 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#34C759', backgroundColor: '#34C759' },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 15, color: '#333', flex: 1 },
  formImageThumb: { width: 120, height: 90, borderRadius: 8, marginBottom: 8, backgroundColor: '#eee' },
  uploadImageBtn: { backgroundColor: '#34C759', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  uploadImageBtnDisabled: { opacity: 0.7 },
  uploadImageBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textareaInput: { minHeight: 120, paddingTop: 12 },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  selectTouchText: { fontSize: 16, color: '#333' },
  selectTouchPlaceholder: { color: '#999' },
  selectTouchArrow: { fontSize: 12, color: '#666' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  pickerTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  pickerScroll: { maxHeight: 320 },
  pickerItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  pickerItemText: { fontSize: 16, color: '#333' },
  pickerLoading: { padding: 24, alignItems: 'center' },
  pickerLoadingText: { marginTop: 8, fontSize: 14, color: '#666' },
  pickerEmptyText: { padding: 20, fontSize: 14, color: '#666', textAlign: 'center' },
  pickerClose: { padding: 16, alignItems: 'center' },
  pickerCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
  datePickerWrap: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
  datePickerOkBtn: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#34C759', borderRadius: 12, alignSelf: 'center' },
  datePickerOkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalActions: { flexDirection: 'row', padding: 20, gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#34C759', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  /** Form kutusu içinde liman seçici (tek Modal içinde) */
  limanTimeInlineLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 24,
    justifyContent: 'flex-end',
  },
  limanTimeInlineDim: {
    flex: 1,
    width: '100%',
    minHeight: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  limanTimeSheetContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  limanTimeSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  limanTimeSheetScroll: { maxHeight: 360 },
  limanTimeSheetItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  limanTimeSheetItemText: { fontSize: 16, color: '#333' },
  limanTimeSheetClose: { padding: 16, alignItems: 'center' },
  limanTimeSheetCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
});
