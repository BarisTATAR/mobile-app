import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import { HOME_IMAGE_CACHE_KEY } from '../services/cacheKeys';
import { colors, shadow } from '../theme';
import { useLanguage } from '../i18n/LanguageContext';
import { usePageLanguage } from '../i18n/usePageLanguage';
import { attachLanguageToUser } from '../i18n/userLanguageStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

const APP_USER_KEY = 'appUser';

export default function LoginScreen({ navigation }) {
  const { setLang } = useLanguage();
  const { pageLang, setPageLang, tx } = usePageLanguage('cover', 'tr');
  const [homeImageUrl, setHomeImageUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        if (cancelled) return;
        if (user && user.id && user.rememberMe !== false) {
          const withLang = await attachLanguageToUser(user, user.username);
          await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(withLang));
          await setLang(withLang.language);
          navigation.replace('Main');
          return;
        }
        if (user && user.id && user.rememberMe === false) {
          await AsyncStorage.removeItem(APP_USER_KEY);
        }
        await setLang('tr');
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [navigation, setLang]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      (async () => {
        try {
          const cached = await AsyncStorage.getItem(HOME_IMAGE_CACHE_KEY);
          if (!cancelled && cached) setHomeImageUrl(String(cached).trim());
        } catch (e) {}
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const handleCustomerLogin = () => {
    // Navigate to business login screen
    navigation.navigate('BusinessLogin');
  };

  const handleUsernameLogin = () => {
    // Navigate to user login screen
    navigation.navigate('UserLogin');
  };

  const hasBackground = !!homeImageUrl;

  const content = (
    <View style={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity testID="login-business" style={styles.cornerBtn} onPress={handleCustomerLogin} activeOpacity={0.8}>
          <Text style={[styles.cornerBtnText, hasBackground ? styles.cornerBtnTextOverlay : styles.cornerBtnTextPlain]}>{tx('login.business')}</Text>
        </TouchableOpacity>
        <LanguageSwitcher
          compact
          light={hasBackground}
          value={pageLang}
          onChange={setPageLang}
          testIDPrefix="cover"
        />
      </View>

      <View style={styles.header}>
        <View style={[styles.mark, hasBackground && styles.markOnImage]}>
          <Text style={styles.markText}>48</Text>
        </View>
        <Text style={[styles.title, hasBackground ? styles.titleOverlay : styles.titlePlain]}>48 App</Text>
        <Text style={[styles.subtitle, hasBackground ? styles.subtitleOverlay : styles.subtitlePlain]}>{tx('login.subtitle')}</Text>
      </View>

      <View style={styles.buttonContainer}>
          <TouchableOpacity
            testID="login-user"
            style={styles.button}
            onPress={handleUsernameLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{tx('login.user')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="login-signup"
            style={styles.signUpUnderButton}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.8}
          >
            <Text style={[styles.signUpText, hasBackground ? styles.signUpTextOverlay : styles.signUpTextPlain]}>{tx('login.signup')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="login-guest"
            style={styles.guestButton}
            onPress={() => {
              setLang('tr');
              navigation.replace('Main', { screen: 'Home', params: { guest: true } });
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.guestButtonText, hasBackground ? styles.guestTextOverlay : styles.guestTextPlain]}>{tx('login.guest')}</Text>
          </TouchableOpacity>
        </View>
    </View>
  );

  if (homeImageUrl) {
    return (
      <ImageBackground
        source={{ uri: apiUrl(homeImageUrl) }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.overlay}>
          {content}
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  cornerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cornerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cornerBtnTextPlain: { color: colors.primary },
  cornerBtnTextOverlay: {
    color: colors.primary,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadow.card,
  },
  markOnImage: {
    backgroundColor: colors.primaryDark,
  },
  markText: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  titlePlain: { color: colors.primary },
  titleOverlay: {
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: { fontSize: 16, fontWeight: '500' },
  subtitlePlain: { color: colors.textMuted },
  subtitleOverlay: {
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 340,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    ...shadow.card,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  signUpUnderButton: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signUpText: { fontSize: 16, fontWeight: '700' },
  signUpTextPlain: { color: colors.primary },
  signUpTextOverlay: {
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  guestButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  guestButtonText: { fontSize: 15, fontWeight: '600' },
  guestTextPlain: { color: colors.textMuted },
  guestTextOverlay: {
    color: colors.primary,
  },
});

