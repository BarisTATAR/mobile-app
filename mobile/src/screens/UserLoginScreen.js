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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';

const APP_USER_KEY = 'appUser';

export default function UserLoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [checkingStorage, setCheckingStorage] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(APP_USER_KEY);
        const user = raw ? JSON.parse(raw) : null;
        if (!cancelled && user && user.id && user.rememberMe !== false) {
          navigation.replace('Main');
          return;
        }
      } catch (e) {}
      if (!cancelled) setCheckingStorage(false);
    })();
    return () => { cancelled = true; };
  }, [navigation]);

  const handleLogin = async () => {
    const user = (username || '').trim();
    const pass = password || '';
    if (!user || !pass) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre girin.');
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
        const toSave = { ...data.user, rememberMe: keepSignedIn };
        await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(toSave));
        navigation.replace('Main');
        return;
      }
      Alert.alert('Giriş başarısız', data.error || 'Geçersiz kullanıcı adı veya şifre.');
    } catch (e) {
      console.error('User login error:', e);
      Alert.alert('Hata', 'Sunucuya bağlanılamadı. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStorage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#34C759" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Kullanıcı Girişi</Text>
            <Text style={styles.subtitle}>Lütfen bilgilerinizi girin</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                placeholder="Kullanıcı adınızı girin"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="Şifrenizi girin"
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
              <Text style={styles.checkboxLabel}>Oturum açık kalsın</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#34C759" />
              ) : (
                <Text style={styles.loginButtonText}>Giriş Yap</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
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
  loginButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#34C759',
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
    color: '#34C759',
    fontSize: 18,
    fontWeight: '600',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  backButton: {
    marginTop: 20,
    padding: 15,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
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
    borderColor: '#34C759',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
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

