import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import {
  getProvinces,
  getDistrictsForProvince,
  getNeighborhoods,
  DEFAULT_CITY,
} from '../services/turkeyAddressService';
import { digitsOnly } from '../utils/phoneInput';
import { parseTrDateParts } from '../utils/dateInput';
import DateSlashInput from '../components/DateSlashInput';
import { warmupAfterFirstPaint } from '../services/appWarmup';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { rememberAccountLanguage } from '../i18n/userLanguageStore';


const KVKK_TEXT_VERSION = '2026-09-23';

export default function SignUpScreen({ navigation }) {
  const { tx, t, lang, setLang } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [specialDay, setSpecialDay] = useState('');
  const [city, setCity] = useState(DEFAULT_CITY);
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [provinces, setProvinces] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [neighborhoodsList, setNeighborhoodsList] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [kvkkPhoneShare, setKvkkPhoneShare] = useState(false);
  const [kvkkLocation, setKvkkLocation] = useState(false);
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const passwordContainerRef = useRef(null);
  const passwordRepeatContainerRef = useRef(null);

  const scrollFieldIntoView = (containerRef) => {
    if (!containerRef?.current || !scrollRef.current) return;
    containerRef.current.measureLayout(
      scrollRef.current,
      (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
      },
      () => {}
    );
  };

  useEffect(() => {
    return () => {
      AsyncStorage.getItem('appUser')
        .then((raw) => {
          const user = raw ? JSON.parse(raw) : null;
          if (!user?.id) setLang('tr');
        })
        .catch(() => {});
    };
  }, [setLang]);

  // İlleri yükle, varsayılan Muğla için ilçeleri doldur
  useEffect(() => {
    warmupAfterFirstPaint();
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

  // İl değişince ilçe listesini güncelle, ilçe ve mahalle temizle
  useEffect(() => {
    if (!city || provinces.length === 0) return;
    const districts = getDistrictsForProvince(provinces, city);
    setDistrictsList(districts);
    setDistrict('');
    setNeighborhood('');
    setNeighborhoodsList([]);
  }, [city, provinces]);

  // İlçe değişince mahalleleri yükle, mahalle temizle
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

  const handleSignUp = async () => {
    // Önce şifre eşleşme kontrolü — eşleşmiyorsa kayıt onaylanmasın
    if (password !== passwordRepeat) {
      Alert.alert(tx('Hata'), 'Şifreler eşleşmiyor. Lütfen aynı şifreyi iki kez girin.');
      return;
    }

    if (!username || !password || !passwordRepeat || !name || !surname || !phone || !dateOfBirth || !specialDay || !city || !district || !neighborhood) {
      Alert.alert(tx('Hata'), 'Lütfen tüm alanları doldurun');
      return;
    }

    const birth = parseTrDateParts(dateOfBirth);
    const special = parseTrDateParts(specialDay);
    if (!birth) {
      Alert.alert(tx('Hata'), 'Doğum tarihini GG/AA/YYYY olarak girin.');
      return;
    }
    if (!special) {
      Alert.alert(tx('Hata'), 'Özel gün tarihini GG/AA/YYYY olarak girin.');
      return;
    }

    if (password.length < 6) {
      Alert.alert(tx('Hata'), 'Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (!kvkkPhoneShare || !kvkkLocation) {
      Alert.alert(
        'KVKK onayı gerekli',
        'Kayıt olmak için cep telefonu paylaşımı ve konum kullanımı açık rızalarını onaylamalısınız.'
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: name.trim(),
          surname: surname.trim(),
          phone: phone.trim(),
          dateOfBirth: birth.stored,
          specialDay: special.stored,
          address: {
            city: city.trim(),
            district: district.trim(),
            neighborhood: neighborhood.trim(),
          },
          kvkkConsent: {
            phoneShare: true,
            location: true,
            textVersion: KVKK_TEXT_VERSION,
          },
          language: lang === 'en' ? 'en' : 'tr',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const chosen = lang === 'en' ? 'en' : 'tr';
        await rememberAccountLanguage(username.trim(), data.user?.language || chosen);
        Alert.alert(tx('Başarılı'), 'Kayıt işlemi başarıyla tamamlandı!', [
          {
            text: 'Tamam',
            onPress: () => navigation.replace('Login'),
          },
        ]);
      } else {
        Alert.alert(tx('Hata'), data.error || 'Kayıt sırasında bir hata oluştu');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert(tx('Hata'), 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{tx('Kayıt Ol')}</Text>
              <Text style={styles.subtitle}>{tx('Hesabınızı oluşturun')}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.langBlock}>
                <Text style={styles.label}>{tx('Uygulama dili')}</Text>
                <Text style={styles.langHint}>{tx('Kayıt olduktan sonra dil değiştirilemez.')}</Text>
                <LanguageSwitcher />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Kullanıcı Adı')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tx('Kullanıcı adınızı girin')}
                  placeholderTextColor="#999"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View ref={passwordContainerRef} style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Şifre')}</Text>
                <TextInput
                  testID="signup-password"
                  style={styles.input}
                  placeholder="Şifrenizi girin (en az 6 karakter)"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => scrollFieldIntoView(passwordContainerRef)}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'Gizle' : 'Göster'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View ref={passwordRepeatContainerRef} style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Şifre (Tekrar)')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    passwordRepeatTouched && !passwordsMatch && styles.inputError,
                  ]}
                  testID="signup-password-repeat"
                  placeholder={tx('Şifrenizi tekrar girin')}
                  placeholderTextColor="#999"
                  value={passwordRepeat}
                  onChangeText={setPasswordRepeat}
                  secureTextEntry={!showPasswordRepeat}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => scrollFieldIntoView(passwordRepeatContainerRef)}
                />
                {passwordRepeatTouched && !passwordsMatch && (
                  <Text style={styles.errorText}>{tx('Şifreler eşleşmiyor')}</Text>
                )}
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPasswordRepeat(!showPasswordRepeat)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPasswordRepeat ? 'Gizle' : 'Göster'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('İsim')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="İsminizi girin"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Soyisim')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Soyisminizi girin"
                  placeholderTextColor="#999"
                  value={surname}
                  onChangeText={setSurname}
                  autoCapitalize="words"
                />
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
                <Text style={styles.label}>{tx('Doğum Tarihi')}</Text>
                <DateSlashInput
                  testID="signup-birth-date"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{tx('Yıldönümü / Özel Gün')}</Text>
                <DateSlashInput
                  testID="signup-special-day"
                  value={specialDay}
                  onChange={setSpecialDay}
                />
              </View>

              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>{tx('Adres')}</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>İl</Text>
                <TouchableOpacity
                  style={styles.selectTouch}
                  onPress={() => setShowCityModal(true)}
                  disabled={addressLoading}
                >
                  <Text style={[styles.selectText, !city && styles.selectPlaceholder]}>
                    {city || (addressLoading ? 'Yükleniyor...' : 'İl seçin')}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
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

              <View style={styles.kvkkBox}>
                <Text style={styles.kvkkTitle}>{tx('KVKK Aydınlatma ve Açık Rıza')}</Text>
                <Text style={styles.kvkkIntro}>
                  6698 sayılı KVKK kapsamında kişisel verileriniz, üyelik ve uygulama hizmetleri için işlenir.
                  Aşağıdaki açık rızalar kayıt için zorunludur.
                </Text>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setKvkkPhoneShare((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, kvkkPhoneShare && styles.checkboxChecked]}>
                    {kvkkPhoneShare ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Cep telefonu numaramın rezervasyon, üye doğrulama ve işletmelerle iletişim amacıyla paylaşılmasına açık rıza veriyorum.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setKvkkLocation((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, kvkkLocation && styles.checkboxChecked]}>
                    {kvkkLocation ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Konum verimin nöbetçi eczane, hava durumu ve haritada yakındaki yerleri göstermek amacıyla kullanılmasına açık rıza veriyorum.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowKvkkModal(true)} activeOpacity={0.8}>
                  <Text style={styles.kvkkLink}>{tx('Aydınlatma metnini oku')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.backButton, styles.backButtonBox]}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backButtonText}>{tx('Geri Dön')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="signup-submit"
                  style={[
                    styles.signUpButton,
                    (loading || (passwordRepeatTouched && !passwordsMatch) || !kvkkPhoneShare || !kvkkLocation) && styles.signUpButtonDisabled,
                  ]}
                  onPress={handleSignUp}
                  activeOpacity={0.8}
                  disabled={loading || (passwordRepeatTouched && !passwordsMatch) || !kvkkPhoneShare || !kvkkLocation}
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

      <Modal visible={showCityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCityModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{tx('İl Seçin')}</Text>
            <FlatList
              data={provinces}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setCity(item.name);
                    setShowCityModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCityModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDistrictModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDistrictModal(false)}
          />
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
        </View>
      </Modal>

      <Modal visible={showKvkkModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowKvkkModal(false)}
          />
          <View style={styles.kvkkModalContent}>
            <Text style={styles.modalTitle}>{tx('KVKK Aydınlatma Metni')}</Text>
            <ScrollView style={styles.kvkkModalScroll} contentContainerStyle={styles.kvkkModalScrollContent}>
              <Text style={styles.kvkkModalText}>{t('kvkk.p1')}</Text>
              <Text style={styles.kvkkModalText}>{t('kvkk.p2')}</Text>
              <Text style={styles.kvkkModalText}>{t('kvkk.p3')}</Text>
              <Text style={styles.kvkkModalText}>{t('kvkk.p4')}</Text>
              <Text style={styles.kvkkModalText}>{t('kvkk.p5')}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowKvkkModal(false)}>
              <Text style={styles.modalCloseText}>{tx('Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showNeighborhoodModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowNeighborhoodModal(false)}
          />
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
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  langBlock: {
    marginBottom: 22,
  },
  langHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B4D4A',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 6,
  },
  passwordToggle: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  passwordToggleText: {
    fontSize: 14,
    color: '#1B4D4A',
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionLabelText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
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
  selectText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectPlaceholder: {
    color: '#999',
  },
  selectArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalClose: {
    padding: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4D4A',
  },
  kvkkBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  kvkkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  kvkkIntro: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1B4D4A',
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#1B4D4A',
  },
  checkboxTick: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  kvkkLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4D4A',
    marginTop: 2,
  },
  kvkkModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  kvkkModalScroll: {
    maxHeight: 420,
  },
  kvkkModalScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  kvkkModalText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  signUpButton: {
    flex: 1,
    backgroundColor: '#1B4D4A',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 3,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 18,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
