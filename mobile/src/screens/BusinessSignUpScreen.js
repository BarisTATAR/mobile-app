import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL, apiUrl } from '../config/api';

function formatDateToStr(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDateStr(str) {
  if (!str || typeof str !== 'string') return new Date();
  const match = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
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

function errorIfLicenseExpiryBeforeToday(str) {
  const s = (str != null ? String(str) : '').trim();
  if (!s) return null;
  const part = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return 'Lisans bitiş tarihi YYYY-AA-GG olmalıdır.';
  const today = startOfToday();
  const [y, mo, da] = part.split('-').map((n) => parseInt(n, 10));
  const chosen = new Date(y, mo - 1, da);
  chosen.setHours(0, 0, 0, 0);
  if (chosen < today) return 'Lisans bitiş tarihi bugünden önce olamaz.';
  return null;
}
import {
  getProvinces,
  getDistrictsForProvince,
  getNeighborhoods,
  DEFAULT_CITY,
} from '../services/turkeyAddressService';
import { digitsOnly } from '../utils/phoneInput';
import { LIMAN_UYE_SAAT_SECENEKLERI } from '../utils/limanSaatleri';
import { useLanguage } from '../i18n/LanguageContext';


const FAALIYET_ALANLARI = [
  { id: 'restorant', name: 'Restorant' },
  { id: 'cafe_bar', name: 'Cafe/Bar' },
  { id: 'tekne_turu', name: 'Tekne Turu' },
  { id: 'plaj_beach', name: 'Plaj/Beach' },
];

const SAAT_SECENEKLERI = ['Kapalı', ...Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`)];
// 07:00 - 23:00 + Kapalı

export default function BusinessSignUpScreen({ navigation }) {
  const { tx } = useLanguage();
  const [businessName, setBusinessName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [phone, setPhone] = useState('');
  const [activityField, setActivityField] = useState('');
  const [city] = useState(DEFAULT_CITY); // İl sabit: Muğla, değiştirilemez
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [googleLocation, setGoogleLocation] = useState('');
  const [weekdaysOpen, setWeekdaysOpen] = useState('');
  const [weekdaysClose, setWeekdaysClose] = useState('');
  const [weekendOpen, setWeekendOpen] = useState('');
  const [weekendClose, setWeekendClose] = useState('');
  const [menuPdfUrl, setMenuPdfUrl] = useState('');
  const [menuPdfName, setMenuPdfName] = useState('');
  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [hasChargingStation, setHasChargingStation] = useState(false);
  const [hasFreeParking, setHasFreeParking] = useState(false);
  const [hasFreeValet, setHasFreeValet] = useState(false);
  const [hasPaidParking, setHasPaidParking] = useState(false);
  const [hasPaidValet, setHasPaidValet] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [neighborhoodsList, setNeighborhoodsList] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [timeModalTarget, setTimeModalTarget] = useState(null); // 'weekdaysOpen' | 'weekdaysClose' | 'weekendOpen' | 'weekendClose'
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseExpiryDatePicker, setLicenseExpiryDatePicker] = useState(false);
  const [limanCikisSaati, setLimanCikisSaati] = useState('09:00');
  const [limanGelisSaati, setLimanGelisSaati] = useState('18:00');
  const [limanTimeModalTarget, setLimanTimeModalTarget] = useState(null); // 'cikis' | 'gelis'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getProvinces();
      if (cancelled) return;
      setProvinces(list);
      const districts = getDistrictsForProvince(list, DEFAULT_CITY);
      setDistrictsList(districts);
      setAddressLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!city || provinces.length === 0) return;
    const districts = getDistrictsForProvince(provinces, city);
    setDistrictsList(districts);
    setDistrict('');
    setNeighborhood('');
    setNeighborhoodsList([]);
  }, [city, provinces]);

  useEffect(() => {
    if (!city || !district) {
      setNeighborhoodsList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const list = await getNeighborhoods(city, district);
      if (cancelled) return;
      setNeighborhoodsList(list);
      setNeighborhood('');
    })();
    return () => { cancelled = true; };
  }, [city, district]);

  const passwordsMatch = password === passwordRepeat;
  const passwordRepeatTouched = passwordRepeat.length > 0;

  const pickAndUploadPdf = async () => {
    let DocumentPicker;
    try {
      DocumentPicker = require('expo-document-picker');
    } catch (_) {
      Alert.alert('Bilgi', 'PDF eklemek için terminalde: cd mobile && npx expo install expo-document-picker');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const canceled = result.canceled === true || result.type === 'cancel';
      if (canceled) return;
      const file = result.assets?.[0] || (result.uri && { uri: result.uri, name: result.name || 'menu.pdf' });
      if (!file || !file.uri) return;
      setUploadingPdf(true);
      const formData = new FormData();
      formData.append('menuPdf', {
        uri: file.uri,
        type: 'application/pdf',
        name: file.name || 'menu.pdf',
      });
      const res = await fetch(`${API_BASE_URL}/api/upload-menu-pdf`, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        const base = API_BASE_URL.replace(/\/$/, '');
        const path = data.url.startsWith('/') ? data.url : '/' + data.url;
        setMenuPdfUrl(base + path);
        setMenuPdfName(file.name || 'menu.pdf');
      } else {
        Alert.alert(tx('Hata'), data.error || 'PDF yüklenemedi');
      }
    } catch (e) {
      console.error(e);
      Alert.alert(tx('Hata'), 'PDF seçilemedi veya yüklenemedi');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSignUp = async () => {
    if (password !== passwordRepeat) {
      Alert.alert(tx('Hata'), 'Şifreler eşleşmiyor. Lütfen aynı şifreyi iki kez girin.');
      return;
    }
    if (!businessName || !password || !passwordRepeat || !activityField || !city || !district || !neighborhood) {
      Alert.alert(tx('Hata'), 'Lütfen tüm alanları doldurun');
      return;
    }
    if (activityField === 'tekne_turu' && (!limanCikisSaati || !limanGelisSaati)) {
      Alert.alert(tx('Hata'), 'Tekne turu için liman çıkış ve geliş saatlerini seçin');
      return;
    }
    if (password.length < 6) {
      Alert.alert(tx('Hata'), 'Şifre en az 6 karakter olmalıdır');
      return;
    }
    if (licenseExpiry.trim()) {
      const licErr = errorIfLicenseExpiryBeforeToday(licenseExpiry.trim());
      if (licErr) {
        Alert.alert(tx('Tarih'), licErr);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/register-business'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          password,
          phone: phone.trim(),
          activityField,
          googleLocation: googleLocation.trim() || undefined,
          openingHours:
            activityField === 'tekne_turu'
              ? {
                  weekdays: { open: 'Kapalı', close: '' },
                  weekend: { open: 'Kapalı', close: '' },
                }
              : {
                  weekdays: { open: weekdaysOpen || 'Kapalı', close: weekdaysClose || '' },
                  weekend: { open: weekendOpen || 'Kapalı', close: weekendClose || '' },
                },
          menuPdfUrl: menuPdfUrl || undefined,
          googleReviewLink: googleReviewLink.trim() || undefined,
          website: website.trim() || undefined,
          instagram: instagram.trim() || undefined,
          hasChargingStation,
          hasFreeParking,
          hasFreeValet,
          hasPaidParking,
          hasPaidValet,
          address: {
            city: city.trim(),
            district: district.trim(),
            neighborhood: neighborhood.trim(),
          },
          licenseExpiry: licenseExpiry.trim() || undefined,
          ...(activityField === 'tekne_turu' ? { limanCikisSaati: limanCikisSaati.trim(), limanGelisSaati: limanGelisSaati.trim() } : {}),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert(tx('Kayıt Alındı'), 'Kaydınız admin onayına gönderildi. Onaylandıktan sonra işletme girişi yapabilirsiniz.', [
          { text: 'Tamam', onPress: () => navigation.replace('Login') },
        ]);
      } else {
        Alert.alert(tx('Hata'), data.error || 'Kayıt sırasında bir hata oluştu');
      }
    } catch (error) {
      console.error('Business registration error:', error);
      Alert.alert(tx('Hata'), 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{tx('İşletme Kayıt')}</Text>
              <Text style={styles.subtitle}>{tx('İşletmenizi kaydedin')}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('İşletme Adı')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tx('İşletme adını girin')}
                  placeholderTextColor="#999"
                  value={businessName}
                  onChangeText={setBusinessName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Şifre')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tx('Şifre (en az 6 karakter)')}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.passwordToggleText}>{showPassword ? 'Gizle' : 'Göster'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Şifre (Tekrar)')}</Text>
                <TextInput
                  style={[styles.input, passwordRepeatTouched && !passwordsMatch && styles.inputError]}
                  placeholder={tx('Şifrenizi tekrar girin')}
                  placeholderTextColor="#999"
                  value={passwordRepeat}
                  onChangeText={setPasswordRepeat}
                  secureTextEntry={!showPasswordRepeat}
                  autoCapitalize="none"
                />
                {passwordRepeatTouched && !passwordsMatch && (
                  <Text style={styles.errorText}>{tx('Şifreler eşleşmiyor')}</Text>
                )}
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPasswordRepeat(!showPasswordRepeat)}>
                  <Text style={styles.passwordToggleText}>{showPasswordRepeat ? 'Gizle' : 'Göster'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Cep Telefonu')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tx('Sadece rakam, örn. 05551234567')}
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={(t) => setPhone(digitsOnly(t))}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Lisans bitiş tarihi')}</Text>
                <TouchableOpacity
                  style={styles.selectTouch}
                  onPress={() => setLicenseExpiryDatePicker(true)}
                >
                  <Text style={[styles.selectText, !licenseExpiry && styles.selectPlaceholder]}>
                    {licenseExpiry || 'Tarih seçin'}
                  </Text>
                  <Text style={styles.selectArrow}>📅</Text>
                </TouchableOpacity>
              </View>

              {licenseExpiryDatePicker ? (
                <View style={styles.datePickerWrap}>
                  <DateTimePicker
                    value={dateNotBeforeToday(parseDateStr(licenseExpiry))}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={startOfToday()}
                    onChange={(event, selectedDate) => {
                      const d = dateNotBeforeToday(selectedDate || new Date());
                      if (Platform.OS === 'android') {
                        setLicenseExpiryDatePicker(false);
                        if (event.type !== 'dismissed') setLicenseExpiry(formatDateToStr(d));
                      } else {
                        setLicenseExpiry(formatDateToStr(d));
                      }
                    }}
                    locale="tr-TR"
                  />
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity style={styles.datePickerOk} onPress={() => setLicenseExpiryDatePicker(false)}>
                      <Text style={styles.datePickerOkText}>{tx('Tamam')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Faaliyet Alanı')}</Text>
                <TouchableOpacity
                  style={styles.selectTouch}
                  onPress={() => setShowActivityModal(true)}
                >
                  <Text style={[styles.selectText, !activityField && styles.selectPlaceholder]}>
                    {activityField ? FAALIYET_ALANLARI.find((a) => a.id === activityField)?.name || activityField : 'Faaliyet alanı seçin'}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>{tx('İşletme Konum')}</Text>
              </View>

              {district && neighborhood ? (
                <View style={styles.locationSummary}>
                  <Text style={styles.locationSummaryText}>
                    Muğla, {district}, {neighborhood}
                  </Text>
                </View>
              ) : null}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>İl</Text>
                <View style={styles.fixedValue}>
                  <Text style={styles.fixedValueText}>Muğla</Text>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('İlçe')}</Text>
                <TouchableOpacity
                  style={styles.selectTouch}
                  onPress={() => city && setShowDistrictModal(true)}
                  disabled={!city || addressLoading}
                >
                  <Text style={[styles.selectText, !district && styles.selectPlaceholder]}>
                    {district || 'İlçe seçin'}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Mahalle')}</Text>
                <TouchableOpacity
                  style={styles.selectTouch}
                  onPress={() => district && setShowNeighborhoodModal(true)}
                  disabled={!district}
                >
                  <Text style={[styles.selectText, !neighborhood && styles.selectPlaceholder]}>
                    {neighborhood || 'Mahalle seçin'}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Konum (Google linki veya adres)')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tx('Örn: Konak, Atatürk Cd., 48500 Yatağan/Muğla')}
                  placeholderTextColor="#999"
                  value={googleLocation}
                  onChangeText={setGoogleLocation}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  keyboardType="default"
                />
              </View>

              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>{tx('Menü / Fiyat Listesi')}</Text>
              </View>
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.pdfButton}
                  onPress={pickAndUploadPdf}
                  disabled={uploadingPdf}
                >
                  {uploadingPdf ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.pdfButtonText}>{menuPdfName ? `✓ ${menuPdfName}` : 'PDF Ekle'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>{tx('Varsa ekleyin')}</Text>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Google değerlendirme puanı (link)')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Google puan/review linki"
                  placeholderTextColor="#999"
                  value={googleReviewLink}
                  onChangeText={setGoogleReviewLink}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Website</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor="#999"
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Instagram</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://instagram.com/..."
                  placeholderTextColor="#999"
                  value={instagram}
                  onChangeText={setInstagram}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>{tx('Olanaklar (varsa işaretleyin)')}</Text>
              </View>
              {[
                { key: 'charging', label: 'Elektrikli şarj istasyonu', value: hasChargingStation, set: setHasChargingStation },
                { key: 'freeParking', label: 'Ücretsiz otopark', value: hasFreeParking, set: setHasFreeParking },
                { key: 'freeValet', label: 'Ücretsiz vale', value: hasFreeValet, set: setHasFreeValet },
                { key: 'paidParking', label: 'Ücretli otopark', value: hasPaidParking, set: setHasPaidParking },
                { key: 'paidValet', label: 'Ücretli vale', value: hasPaidValet, set: setHasPaidValet },
              ].map(({ key, label, value, set }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.checkboxRow}
                  onPress={() => set(!value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                    {value && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>{label}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>
                  {activityField === 'tekne_turu' ? 'Liman saatleri (tekne turu)' : 'Açık Gün ve Saatler'}
                </Text>
              </View>

              {activityField === 'tekne_turu' ? (
                <>
                  <View style={styles.hoursRow}>
                    <Text style={styles.hoursLabel}>{tx('Çıkış')}</Text>
                    <View style={[styles.hoursInputs, { flex: 1, justifyContent: 'flex-end' }]}>
                      <TouchableOpacity
                        style={[styles.timeTouch, { flex: 1, maxWidth: '100%' }]}
                        onPress={() => setLimanTimeModalTarget('cikis')}
                      >
                        <Text style={styles.selectText}>{limanCikisSaati}</Text>
                        <Text style={styles.selectArrow}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.hoursRow}>
                    <Text style={styles.hoursLabel}>Geliş</Text>
                    <View style={[styles.hoursInputs, { flex: 1, justifyContent: 'flex-end' }]}>
                      <TouchableOpacity
                        style={[styles.timeTouch, { flex: 1, maxWidth: '100%' }]}
                        onPress={() => setLimanTimeModalTarget('gelis')}
                      >
                        <Text style={styles.selectText}>{limanGelisSaati}</Text>
                        <Text style={styles.selectArrow}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.hoursRow}>
                    <Text style={styles.hoursLabel}>{tx('Hafta içi')}</Text>
                    <View style={styles.hoursInputs}>
                      <TouchableOpacity
                        style={styles.timeTouch}
                        onPress={() => setTimeModalTarget('weekdaysOpen')}
                      >
                        <Text style={[styles.selectText, !weekdaysOpen && styles.selectPlaceholder]}>
                          {weekdaysOpen || 'Açılış'}
                        </Text>
                        <Text style={styles.selectArrow}>▼</Text>
                      </TouchableOpacity>
                      <Text style={styles.hoursDash}>–</Text>
                      <TouchableOpacity
                        style={styles.timeTouch}
                        onPress={() => setTimeModalTarget('weekdaysClose')}
                      >
                        <Text style={[styles.selectText, !weekdaysClose && styles.selectPlaceholder]}>
                          {weekdaysClose || 'Kapanış'}
                        </Text>
                        <Text style={styles.selectArrow}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.hoursRow}>
                    <Text style={styles.hoursLabel}>{tx('Hafta sonu')}</Text>
                    <View style={styles.hoursInputs}>
                      <TouchableOpacity
                        style={styles.timeTouch}
                        onPress={() => setTimeModalTarget('weekendOpen')}
                      >
                        <Text style={[styles.selectText, !weekendOpen && styles.selectPlaceholder]}>
                          {weekendOpen || 'Açılış'}
                        </Text>
                        <Text style={styles.selectArrow}>▼</Text>
                      </TouchableOpacity>
                      <Text style={styles.hoursDash}>–</Text>
                      <TouchableOpacity
                        style={styles.timeTouch}
                        onPress={() => setTimeModalTarget('weekendClose')}
                      >
                        <Text style={[styles.selectText, !weekendClose && styles.selectPlaceholder]}>
                          {weekendClose || 'Kapanış'}
                        </Text>
                        <Text style={styles.selectArrow}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Saat seçim modal */}
              <Modal visible={!!timeModalTarget} transparent animationType="slide">
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setTimeModalTarget(null)}
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{tx('Saat Seçin')}</Text>
                    <FlatList
                      data={SAAT_SECENEKLERI}
                      keyExtractor={(item) => item}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalItem}
                          onPress={() => {
                            if (timeModalTarget === 'weekdaysOpen') setWeekdaysOpen(item);
                            if (timeModalTarget === 'weekdaysClose') setWeekdaysClose(item);
                            if (timeModalTarget === 'weekendOpen') setWeekendOpen(item);
                            if (timeModalTarget === 'weekendClose') setWeekendClose(item);
                            setTimeModalTarget(null);
                          }}
                        >
                          <Text style={styles.modalItemText}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity style={styles.modalClose} onPress={() => setTimeModalTarget(null)}>
                      <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* Faaliyet alanı modal */}
              <Modal visible={showActivityModal} transparent animationType="slide">
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setShowActivityModal(false)}
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{tx('Faaliyet Alanı Seçin')}</Text>
                    {FAALIYET_ALANLARI.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.modalItem}
                        onPress={() => {
                          setActivityField(item.id);
                          if (item.id === 'tekne_turu') {
                            setWeekdaysOpen('');
                            setWeekdaysClose('');
                            setWeekendOpen('');
                            setWeekendClose('');
                          }
                          setShowActivityModal(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.modalClose} onPress={() => setShowActivityModal(false)}>
                      <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* Tekne turu liman saati modal */}
              <Modal visible={!!limanTimeModalTarget} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLimanTimeModalTarget(null)}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{limanTimeModalTarget === 'cikis' ? 'Liman çıkış saati' : 'Liman geliş saati'}</Text>
                    {LIMAN_UYE_SAAT_SECENEKLERI.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={styles.modalItem}
                        onPress={() => {
                          if (limanTimeModalTarget === 'cikis') setLimanCikisSaati(s);
                          else setLimanGelisSaati(s);
                          setLimanTimeModalTarget(null);
                        }}
                      >
                        <Text style={styles.modalItemText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.modalClose} onPress={() => setLimanTimeModalTarget(null)}>
                      <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* İlçe modal */}
              <Modal visible={showDistrictModal} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDistrictModal(false)}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{tx('İlçe Seçin')}</Text>
                    <FlatList
                      data={districtsList}
                      keyExtractor={(item) => String(item.id)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalItem}
                          onPress={() => {
                            setDistrict(item.name);
                            setShowDistrictModal(false);
                          }}
                        >
                          <Text style={styles.modalItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity style={styles.modalClose} onPress={() => setShowDistrictModal(false)}>
                      <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* Mahalle modal */}
              <Modal visible={showNeighborhoodModal} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNeighborhoodModal(false)}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{tx('Mahalle Seçin')}</Text>
                    <FlatList
                      data={neighborhoodsList}
                      keyExtractor={(item) => String(item.id)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.modalItem}
                          onPress={() => {
                            setNeighborhood(item.name);
                            setShowNeighborhoodModal(false);
                          }}
                        >
                          <Text style={styles.modalItemText}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity style={styles.modalClose} onPress={() => setShowNeighborhoodModal(false)}>
                      <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.backButton, styles.backButtonBox]}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backButtonText}>{tx('Geri Dön')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.signUpButton,
                    (loading || (passwordRepeatTouched && !passwordsMatch)) && styles.signUpButtonDisabled,
                  ]}
                  onPress={handleSignUp}
                  activeOpacity={0.8}
                  disabled={loading || (passwordRepeatTouched && !passwordsMatch)}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.signUpButtonText}>{tx('Kayıt Ol')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, padding: 20, paddingTop: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1B4D4A', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666' },
  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: 13, color: '#FF3B30', marginTop: 6 },
  passwordToggle: { marginTop: 8, alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 },
  passwordToggleText: { fontSize: 14, color: '#1B4D4A', fontWeight: '600' },
  sectionLabel: { marginTop: 8, marginBottom: 12 },
  sectionLabelText: { fontSize: 18, fontWeight: '600', color: '#333' },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    minHeight: 50,
  },
  selectText: { fontSize: 16, color: '#333', flex: 1 },
  selectPlaceholder: { color: '#999' },
  selectArrow: { fontSize: 12, color: '#666', marginLeft: 8 },
  fixedValue: {
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    padding: 15,
    minHeight: 50,
    justifyContent: 'center',
  },
  fixedValueText: { fontSize: 16, color: '#666' },
  locationSummary: {
    backgroundColor: '#E6F0EF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1B4D4A',
  },
  locationSummaryText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  hoursLabel: {
    width: 90,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  hoursInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
  },
  hoursDash: { fontSize: 16, color: '#666', fontWeight: '600' },
  pdfButton: {
    backgroundColor: '#1B4D4A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pdfButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
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
  checkboxChecked: {
    borderColor: '#1B4D4A',
    backgroundColor: '#1B4D4A',
  },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 15, color: '#333', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#1B4D4A' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 },
  signUpButton: {
    flex: 1,
    backgroundColor: '#1B4D4A',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 3,
  },
  signUpButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  signUpButtonDisabled: { opacity: 0.6 },
  backButton: { alignItems: 'center', justifyContent: 'center' },
  backButtonBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 18,
    borderRadius: 12,
  },
  backButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  datePickerWrap: { marginBottom: 16 },
  datePickerOk: { padding: 14, alignItems: 'center', backgroundColor: '#1B4D4A', borderRadius: 12, marginTop: 8 },
  datePickerOkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
