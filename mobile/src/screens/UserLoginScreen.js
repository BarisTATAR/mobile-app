import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import { warmupAfterFirstPaint } from '../services/appWarmup';
import { colors, shadow } from '../theme';
import { useLanguage } from '../i18n/LanguageContext';
import { usePageLanguage } from '../i18n/usePageLanguage';
import { attachLanguageToUser } from '../i18n/userLanguageStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

const APP_USER_KEY = 'appUser';

export default function UserLoginScreen({ navigation }) {
  const { setLang } = useLanguage();
  const { pageLang, setPageLang, tx } = usePageLanguage('userLogin', 'tr');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  useEffect(() => {
    warmupAfterFirstPaint();
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        if (!cancelled && user && user.id && user.rememberMe !== false) {
          const withLang = await attachLanguageToUser(user, user.username);
          await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(withLang));
          await setLang(withLang.language);
          navigation.replace('Main');
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [navigation]);

  const handleLogin = async () => {
    const user = (username || '').trim();
    const pass = password || '';
    if (!user || !pass) {
      Alert.alert(tx('Hata'), tx('Kullanıcı adı ve şifre girin.'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/login-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.user) {
        const withLang = await attachLanguageToUser(data.user, user);
        const toSave = { ...withLang, rememberMe: keepSignedIn };
        await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(toSave));
        await setLang(toSave.language);
        navigation.replace('Main');
        return;
      }
      Alert.alert(tx('Giriş başarısız'), data.error || tx('Geçersiz kullanıcı adı veya şifre.'));
    } catch (e) {
      console.error('User login error:', e);
      Alert.alert(tx('Hata'), tx('Sunucuya bağlanılamadı. Backend çalışıyor mu?'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
          <View style={styles.topBar}>
            <TouchableOpacity
              testID="login-back"
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.backButtonText}>{tx('Geri Dön')}</Text>
            </TouchableOpacity>
            <LanguageSwitcher
              compact
              value={pageLang}
              onChange={setPageLang}
              testIDPrefix="user-login"
            />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>{tx('Kullanıcı Girişi')}</Text>
            <Text style={styles.subtitle}>{tx('Lütfen bilgilerinizi girin')}</Text>
          </View>

          <View style={styles.formContainer}>
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
                spellCheck={false}
                textContentType="none"
                autoComplete="off"
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
                spellCheck={false}
                textContentType="none"
                autoComplete="off"
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
              testID="login-submit"
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.loginButtonText}>{tx('Giriş Yap')}</Text>
              )}
            </TouchableOpacity>
          </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  loginButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
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
    borderColor: colors.primary,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxTick: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: colors.text,
  },
});

