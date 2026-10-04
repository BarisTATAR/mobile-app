import React, { useState } from 'react';
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
import { apiUrl } from '../config/api';
import { useLanguage } from '../i18n/LanguageContext';


export default function AdminLoginScreen({ navigation }) {
  const { tx } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert(tx('Hata'), tx('Kullanıcı adı ve şifre girin'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/login-admin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        navigation.replace('AdminMain');
      } else {
        Alert.alert(tx('Hata'), data.error || 'Giriş yapılamadı');
      }
    } catch (e) {
      console.error(e);
      Alert.alert(tx('Hata'), 'Sunucuya bağlanılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{tx('Admin Girişi')}</Text>
            <Text style={styles.subtitle}>{tx('Yönetici hesabıyla giriş yapın')}</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{tx('Admin Kullanıcı Adı')}</Text>
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

            <TouchableOpacity
              style={styles.signUpLink}
              onPress={() => navigation.navigate('AdminSignUp')}
            >
              <Text style={styles.signUpLinkText}>{tx('Admin Üye Ol')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>{tx('Geri Dön')}</Text>
          </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  loginButtonDisabled: { opacity: 0.7 },
  signUpLink: { marginTop: 16, alignItems: 'center' },
  signUpLinkText: { color: '#1B4D4A', fontSize: 14, fontWeight: '600' },
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
});
