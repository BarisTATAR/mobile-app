import React, { useState } from 'react';
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
import { API_BASE_URL } from '../config/api';
import { useLanguage } from '../i18n/LanguageContext';


export default function AdminSignUpScreen({ navigation }) {
  const { tx } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!username.trim() || !password || !passwordRepeat) {
      Alert.alert(tx('Hata'), 'Kullanıcı adı ve şifre alanları zorunludur');
      return;
    }
    if (password !== passwordRepeat) {
      Alert.alert(tx('Hata'), 'Şifreler eşleşmiyor');
      return;
    }
    if (password.length < 6) {
      Alert.alert(tx('Hata'), 'Şifre en az 6 karakter olmalıdır');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/register-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        Alert.alert(tx('Başarılı'), 'Admin kaydı oluşturuldu. Giriş yapabilirsiniz.', [
          { text: 'Tamam', onPress: () => navigation.replace('AdminLogin') },
        ]);
      } else {
        Alert.alert(tx('Hata'), data.error || 'Kayıt yapılamadı');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{tx('Admin Kayıt')}</Text>
            <Text style={styles.subtitle}>Yönetici hesabı oluşturun (veritabanına kaydedilir)</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{tx('Kullanıcı Adı')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('Admin kullanıcı adı')}
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ad (isteğe bağlı)</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('Adınız')}
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{tx('Şifre')}</Text>
              <TextInput
                style={styles.input}
                placeholder="En az 6 karakter"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{tx('Şifre (Tekrar)')}</Text>
              <TextInput
                style={styles.input}
                placeholder={tx('Şifrenizi tekrar girin')}
                placeholderTextColor="#999"
                value={passwordRepeat}
                onChangeText={setPasswordRepeat}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{tx('Kayıt Ol')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>{tx('Geri Dön')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  keyboardView: { flex: 1 },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1B4D4A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
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
  submitButton: {
    backgroundColor: '#1B4D4A',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  submitButtonDisabled: { opacity: 0.7 },
  backButton: { marginTop: 24, padding: 15, alignItems: 'center' },
  backButtonText: { color: '#1B4D4A', fontSize: 16, fontWeight: '600' },
});
