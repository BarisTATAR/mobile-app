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

const PREMIUM_LISTING_SESSION_KEY = 'premiumListingSession';

const LISTING_TYPES = [
  { id: 'esnaf', label: 'Esnaf' },
  { id: 'cekici', label: 'Çekici' },
  { id: 'lastikci', label: 'Lastikçi' },
  { id: 'taksi', label: 'Taksi' },
];

export default function PremiumListingLoginScreen({ navigation }) {
  const [listingType, setListingType] = useState('esnaf');
  const [loginKey, setLoginKey] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREMIUM_LISTING_SESSION_KEY);
        const session = raw ? JSON.parse(raw) : null;
        if (!cancelled && session?.ownerId && session?.ownerType && session?.loginKey) {
          navigation.replace('PremiumListingMain', session);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [navigation]);

  const handleLogin = async () => {
    if (!loginKey.trim() || !password) {
      Alert.alert('Uyarı', 'Telefon veya işletme adı ve şifre girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/login-premium-listing'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingType,
          loginKey: loginKey.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        Alert.alert('Giriş başarısız', data.error || 'Geçersiz bilgi veya premium değil.');
        return;
      }
      const session = {
        ownerType: data.ownerType,
        ownerId: data.ownerId,
        loginKey: data.loginKey || loginKey.trim(),
        displayName: data.displayName || '',
        registeredDistrict: data.registeredDistrict || '',
      };
      await AsyncStorage.setItem(PREMIUM_LISTING_SESSION_KEY, JSON.stringify(session));
      navigation.replace('PremiumListingMain', session);
    } catch (e) {
      Alert.alert('Hata', 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Premium Liste Girişi</Text>
          <Text style={styles.hint}>
            Admin tarafından premium işaretlenmiş esnaf, çekici, lastikçi veya taksi hesabıyla kampanya ve iş ilanı yönetin.
          </Text>

          <Text style={styles.label}>Liste türü</Text>
          <View style={styles.typeRow}>
            {LISTING_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, listingType === t.id && styles.typeChipActive]}
                onPress={() => setListingType(t.id)}
              >
                <Text style={[styles.typeChipText, listingType === t.id && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Telefon veya işletme adı</Text>
          <TextInput
            style={styles.input}
            value={loginKey}
            onChangeText={setLoginKey}
            placeholder="Kayıtlı telefon veya ad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Premium şifre</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Adminin verdiği şifre"
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Giriş Yap</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Geri</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export { PREMIUM_LISTING_SESSION_KEY };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  flex: { flex: 1 },
  content: { padding: 20 },
  spinner: { marginTop: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 8 },
  hint: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
  },
  typeChipActive: { backgroundColor: '#34C759' },
  typeChipText: { fontSize: 13, color: '#444' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  loginBtn: {
    backgroundColor: '#34C759',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backBtn: { marginTop: 16, alignItems: 'center', padding: 10 },
  backBtnText: { color: '#34C759', fontSize: 15 },
});
