import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadow } from '../theme';
import { useLanguage } from '../i18n/LanguageContext';

const APP_USER_KEY = 'appUser';

export default function SettingsScreen({ navigation }) {
  const { tx, setLang } = useLanguage();
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(APP_USER_KEY);
    } catch (e) {}
    await setLang('tr');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>{tx('Hesap')}</Text>
        <Text style={styles.subtitle}>{tx('Oturumu güvenle kapatabilirsiniz')}</Text>
      </View>
      <View style={styles.body}>
        <TouchableOpacity testID="logout-button" style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>{tx('Çıkış Yap')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  body: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: colors.danger,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 220,
    ...shadow.card,
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
