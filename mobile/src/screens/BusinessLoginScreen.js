import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import { PREMIUM_LISTING_SESSION_KEY } from './PremiumListingLoginScreen';
import { useLanguage } from '../i18n/LanguageContext';


const APP_BUSINESS_KEY = 'businessSession';

const OPERATOR_TYPES = [
  { id: 'isletme', label: 'Rezervasyon işletmesi' },
  { id: 'esnaf', label: 'Esnaf' },
  { id: 'cekici', label: 'Çekici' },
  { id: 'lastikci', label: 'Lastikçi' },
  { id: 'taksi', label: 'Taksi' },
];

const LOGIN_HINTS = {
  isletme: 'Adminin kaydettiği işletme adı ve şifre ile girin.',
  esnaf: 'Kayıtlı esnaf adı veya telefon + adminin verdiği premium şifre.',
  cekici: 'Kayıtlı firma adı veya telefon + adminin verdiği premium şifre.',
  lastikci: 'Kayıtlı ad veya telefon + adminin verdiği premium şifre.',
  taksi: 'Kayıtlı firma adı veya telefon + adminin verdiği premium şifre.',
};

const LOGIN_LABELS = {
  isletme: 'İşletme adı',
  esnaf: 'Esnaf adı veya telefon',
  cekici: 'Firma adı veya telefon',
  lastikci: 'Ad veya telefon',
  taksi: 'Firma adı veya telefon',
};

export default function BusinessLoginScreen({ navigation }) {
  const { tx } = useLanguage();
  const [operatorType, setOperatorType] = useState('isletme');
  const [loginKey, setLoginKey] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rawBusiness = await AsyncStorage.getItem(APP_BUSINESS_KEY);
        const session = rawBusiness ? JSON.parse(rawBusiness) : null;
        if (!cancelled && session?.businessId && session?.businessName) {
          navigation.replace('BusinessMain', {
            businessId: session.businessId,
            businessName: session.businessName,
            activityField: session.activityField,
            premium: session.premium === true,
            calendarResetKey: Date.now(),
          });
          return;
        }
        const rawPremium = await AsyncStorage.getItem(PREMIUM_LISTING_SESSION_KEY);
        const premiumSession = rawPremium ? JSON.parse(rawPremium) : null;
        if (!cancelled && premiumSession?.ownerId && premiumSession?.ownerType && premiumSession?.loginKey) {
          navigation.replace('PremiumListingMain', premiumSession);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [navigation]);

  const handleLogin = async () => {
    if (!loginKey.trim() || !password) {
      Alert.alert(tx('Uyarı'), 'Giriş bilgisi ve şifre girin.');
      return;
    }
    setLoading(true);
    try {
      if (operatorType === 'isletme') {
        const res = await fetch(apiUrl('/api/login-business'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: loginKey.trim(),
            password,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.business) {
          if (keepSignedIn) {
            await AsyncStorage.setItem(
              APP_BUSINESS_KEY,
              JSON.stringify({
                businessId: data.business.id,
                businessName: data.business.businessName,
                activityField: data.business.activityField,
                premium: data.business.premium === true,
              })
            );
          }
          navigation.replace('BusinessMain', {
            businessId: data.business.id,
            businessName: data.business.businessName,
            activityField: data.business.activityField,
            premium: data.business.premium === true,
            calendarResetKey: Date.now(),
          });
          return;
        }
        if (res.status === 404) {
          Alert.alert(
            'Adres bulunamadı',
            "Backend bu isteği tanımıyor. Backend'i yeniden başlatın: cd backend && npm start"
          );
          return;
        }
        Alert.alert(tx('Giriş başarısız'), data.error || 'Geçersiz işletme adı veya şifre.');
        return;
      }

      const res = await fetch(apiUrl('/api/login-premium-listing'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingType: operatorType,
          loginKey: loginKey.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        Alert.alert(
          'Giriş başarısız',
          data.error
            || 'Geçersiz bilgi. Liste türünü (Esnaf/Çekici/Lastikçi/Taksi) doğru seçtiğinizden ve adminin verdiği premium şifreyi kullandığınızdan emin olun.'
        );
        return;
      }
      const session = {
        ownerType: data.ownerType,
        ownerId: data.ownerId,
        loginKey: data.loginKey || loginKey.trim(),
        displayName: data.displayName || '',
        registeredDistrict: data.registeredDistrict || '',
      };
      if (keepSignedIn) {
        await AsyncStorage.setItem(PREMIUM_LISTING_SESSION_KEY, JSON.stringify(session));
      }
      navigation.replace('PremiumListingMain', session);
    } catch (e) {
      Alert.alert(tx('Hata'), 'Sunucuya bağlanılamadı. Backend çalışıyor mu? (cd backend && npm start)');
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>{tx('İşletme Girişi')}</Text>
            <Text style={styles.subtitle}>{tx('İşletme türünü seçin ve bilgilerinizi girin')}</Text>
          </View>

          <Text style={styles.label}>{tx('İşletme türü')}</Text>
          <View style={styles.typeRow}>
            {OPERATOR_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, operatorType === t.id && styles.typeChipActive]}
                onPress={() => setOperatorType(t.id)}
              >
                <Text style={[styles.typeChipText, operatorType === t.id && styles.typeChipTextActive]}>
                  {tx(t.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.hint}>{tx(LOGIN_HINTS[operatorType])}</Text>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{tx(LOGIN_LABELS[operatorType])}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx(LOGIN_LABELS[operatorType])}
                placeholderTextColor="#999"
                value={loginKey}
                onChangeText={setLoginKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{tx('Şifre')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('Şifrenizi girin')}
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setKeepSignedIn((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, keepSignedIn && styles.checkboxChecked]}>
                {keepSignedIn ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>{tx('Oturum açık kalsın')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1B4D4A" />
              ) : (
                <Text style={styles.loginButtonText}>{tx('Giriş Yap')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.extraButtonsRow}>
              <TouchableOpacity
                style={styles.extraButton}
                onPress={() => navigation.navigate('YoreselBusinessLogin')}
                activeOpacity={0.8}
              >
                <Text style={styles.extraButtonText}>{tx('Yöresel İşletme Girişi')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.extraButton}
                onPress={() => navigation.navigate('BusinessSignUp')}
                activeOpacity={0.8}
              >
                <Text style={styles.extraButtonText}>{tx('İşletme Üye Ol')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.extraButton}
                onPress={() => navigation.navigate('AdminLogin')}
                activeOpacity={0.8}
              >
                <Text style={styles.extraButtonText}>{tx('Admin Girişi')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>{tx('Geri Dön')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EB',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
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
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
  },
  typeChipActive: {
    backgroundColor: '#1B4D4A',
  },
  typeChipText: {
    fontSize: 13,
    color: '#444',
  },
  typeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  loginButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1B4D4A',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  loginButtonText: {
    color: '#1B4D4A',
    fontSize: 18,
    fontWeight: '600',
  },
  extraButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  extraButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: '#1B4D4A',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  extraButtonText: {
    color: '#1B4D4A',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#1B4D4A',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#1B4D4A',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1B4D4A',
  },
  checkboxTick: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
});
