import React, { useEffect, useState } from 'react';
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
import { useLanguage } from '../i18n/LanguageContext';


const YORESEL_SESSION_KEY = 'yoreselBusinessSession';

export default function YoreselBusinessLoginScreen({ navigation }) {
  const { tx } = useLanguage();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(YORESEL_SESSION_KEY);
        const session = raw ? JSON.parse(raw) : null;
        if (!cancelled && session?.selectedIsletmeId && Array.isArray(session.isletmeler) && session.isletmeler.length > 0) {
          const multiVenueLogin =
            session.multiVenueLogin === true
            || (session.multiVenueLogin !== false && session.isletmeler.length > 1);
          navigation.replace('YoreselBusinessMain', {
            isletmeler: session.isletmeler,
            selectedIsletmeId: session.selectedIsletmeId,
            loginName: session.loginName || '',
            multiVenueLogin,
            premium: session.premium === true,
          });
          return;
        }
        if (!cancelled && session?.isletmeId && session?.name) {
          navigation.replace('YoreselBusinessMain', {
            isletmeler: [{ id: session.isletmeId, name: session.name }],
            selectedIsletmeId: session.isletmeId,
            loginName: '',
            multiVenueLogin: false,
          });
        }
      } catch (e) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const handleLogin = async () => {
    if (!name.trim() || !password) {
      Alert.alert(tx('Uyarı'), 'Kullanıcı adı ve şifre girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/login-yoresel-isletme'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.isletmeler) ? data.isletmeler : [];
      if (!res.ok || !data.success || list.length === 0) {
        Alert.alert(tx('Giriş başarısız'), data.error || 'Geçersiz kullanıcı adı veya şifre.');
        return;
      }
      const firstId = list[0].id;
      const multiVenueLogin = data.multiVenueLogin === true;
      await AsyncStorage.setItem(
        YORESEL_SESSION_KEY,
        JSON.stringify({
          loginName: name.trim(),
          isletmeler: list,
          selectedIsletmeId: firstId,
          multiVenueLogin,
          premium: data.premium === true,
        })
      );
      navigation.replace('YoreselBusinessMain', {
        isletmeler: list,
        selectedIsletmeId: firstId,
        loginName: name.trim(),
        multiVenueLogin,
        premium: data.premium === true,
      });
    } catch (e) {
      Alert.alert(tx('Hata'), 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
          <Text style={styles.title}>{tx('Yöresel Etkinlik İşletme Girişi')}</Text>
          <Text style={styles.hint}>
            Çoklu mekanda adminin verdiği ortak «giriş kullanıcı adı» ile girin; tek mekanda işletme adı ile de giriş yapılır.
          </Text>
          <TextInput
            style={styles.input}
            placeholder={tx('Kullanıcı adı (veya tek mekanda işletme adı)')}
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="none"
            autoComplete="off"
          />
          <TextInput
            style={styles.input}
            placeholder={tx('Şifre')}
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
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>{tx('Giriş Yap')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{tx('Geri Dön')}</Text>
          </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '700', color: '#1B4D4A', marginBottom: 12, textAlign: 'center' },
  hint: { fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 18, textAlign: 'center' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  loginBtn: { backgroundColor: '#1B4D4A', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  loginText: { color: '#fff', fontWeight: '700' },
  backBtn: { marginTop: 14, alignItems: 'center' },
  backText: { color: '#1B4D4A', fontWeight: '600' },
});
