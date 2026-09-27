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

const APP_USER_KEY = 'appUser';

export default function LoginScreen({ navigation }) {
  const [homeImageUrl, setHomeImageUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        if (cancelled) return;
        if (user && user.id && user.rememberMe !== false) {
          navigation.replace('Main');
          return;
        }
        if (user && user.id && user.rememberMe === false) {
          await AsyncStorage.removeItem(APP_USER_KEY);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [navigation]);

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
        <TouchableOpacity style={styles.cornerBtn} onPress={handleCustomerLogin} activeOpacity={0.8}>
          <Text style={[styles.cornerBtnText, hasBackground ? styles.cornerBtnTextOverlay : styles.cornerBtnTextPlain]}>İşletme</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, hasBackground ? styles.titleOverlay : styles.titlePlain]}>48 App</Text>
        <Text style={[styles.subtitle, hasBackground ? styles.subtitleOverlay : styles.subtitlePlain]}>Hoş Geldiniz</Text>
      </View>

      <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleUsernameLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Kullanıcı Girişi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signUpUnderButton}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.8}
          >
            <Text style={[styles.signUpText, hasBackground ? styles.signUpTextOverlay : styles.signUpTextPlain]}>Kullanıcı Üye Ol</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => navigation.replace('Main', { screen: 'Home', params: { guest: true } })}
            activeOpacity={0.8}
          >
            <Text style={[styles.guestButtonText, hasBackground ? styles.guestTextOverlay : styles.guestTextPlain]}>Üye olmadan devam et</Text>
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
    backgroundColor: '#f5f5f5',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  topRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  cornerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cornerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cornerBtnTextPlain: { color: '#34C759' },
  cornerBtnTextOverlay: {
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  titlePlain: { color: '#34C759' },
  titleOverlay: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: { fontSize: 18 },
  subtitlePlain: { color: '#666' },
  subtitleOverlay: {
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 2,
    borderColor: '#34C759',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  buttonText: {
    color: '#34C759',
    fontSize: 18,
    fontWeight: '600',
  },
  signUpUnderButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  signUpText: { fontSize: 16, fontWeight: '600' },
  signUpTextPlain: { color: '#34C759' },
  signUpTextOverlay: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  guestButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(52,199,89,0.5)',
    alignItems: 'center',
  },
  guestButtonText: { fontSize: 15, fontWeight: '600' },
  guestTextPlain: { color: '#888' },
  guestTextOverlay: {
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

