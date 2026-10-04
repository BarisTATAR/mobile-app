import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { apiUrl, apiFetch } from '../config/api';
import { mediaFilesFromItem } from '../utils/listingMedia';
import ListingMediaFormField from './ListingMediaFormField';
import { useLanguage } from '../i18n/LanguageContext';


const MENU_OWNER_TYPES = new Set(['isletme', 'esnaf', 'cekici', 'lastikci', 'taksi', 'yoresel_etkinlik']);

export default function PremiumMenuEditor({ ownerType, ownerId, loginKey }) {
  const { tx } = useLanguage();
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const supported = MENU_OWNER_TYPES.has(ownerType);
  const authQuery = `loginKey=${encodeURIComponent(loginKey || '')}`;

  const fetchMenu = useCallback(async () => {
    if (!ownerId || !loginKey || !supported) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/premium/${ownerType}/${ownerId}/menu?${authQuery}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMediaFiles(mediaFilesFromItem(data));
      } else {
        setMediaFiles([]);
      }
    } catch (e) {
      setMediaFiles([]);
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId, loginKey, authQuery, supported]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const saveMenu = async () => {
    if (!ownerId || !loginKey) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/premium/${ownerType}/${ownerId}/menu?${authQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginKey,
          mediaFiles,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert(tx('Başarılı'), 'Dosyalar güncellendi.');
        if (Array.isArray(data.mediaFiles)) setMediaFiles(data.mediaFiles);
        else setMediaFiles(mediaFilesFromItem(data));
      } else {
        Alert.alert(tx('Hata'), data.error || 'Kaydedilemedi');
      }
    } catch (e) {
      Alert.alert(tx('Hata'), 'Bağlantı hatası');
    } finally {
      setSaving(false);
    }
  };

  if (!supported) {
    return (
      <View style={styles.centered}>
        <Text style={styles.hint}>Bu işletme türü için menü düzenleme desteklenmiyor.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1B4D4A" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{tx('Fotoğraf / PDF')}</Text>
      <Text style={styles.subtitle}>
        Kullanıcı listesinde görünen dosyalar. Görüntüleyebilir, kaldırabilir veya yeni ekleyebilirsiniz. Kaldırma ve ekleme için Kaydet'e basın.
      </Text>

      <ListingMediaFormField value={mediaFiles} onChange={setMediaFiles} label="Dosyalar" />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={saveMenu}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>{tx('Kaydet')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 14, color: '#666', textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: '#222', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  saveBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
