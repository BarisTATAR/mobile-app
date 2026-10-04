import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { apiUrl, apiFetch } from '../config/api';
import ListingMediaGalleryModal from './ListingMediaGalleryModal';
import { useLanguage } from '../i18n/LanguageContext';


export default function ListingMediaFormField({ value = [], onChange, label = 'Fotoğraf / PDF' }) {
  const { tx } = useLanguage();
  const [pdfUploading, setPdfUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const files = Array.isArray(value) ? value : [];

  const appendFile = (entry) => {
    onChange?.((prev) => {
      const current = Array.isArray(prev) ? prev : files;
      return [...current, entry];
    });
  };

  const openGalleryAt = (index) => {
    const items = files.map((f) => ({
      type: f.type === 'pdf' ? 'pdf' : f.type === 'video' ? 'video' : 'image',
      url: apiUrl(f.url),
    }));
    setGalleryItems(items);
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const removeAt = (index) => {
    Alert.alert(tx('Kaldır'), 'Bu dosya listeden kaldırılacak. Kaydet ile uygulanır.', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: () => {
          onChange?.((prev) => {
            const current = Array.isArray(prev) ? prev : files;
            return current.filter((_, i) => i !== index);
          });
        },
      },
    ]);
  };

  const uploadPdf = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (doc.canceled) return;
      const asset = doc.assets?.[0];
      if (!asset?.uri) {
        Alert.alert(tx('Hata'), 'PDF dosyası seçilemedi.');
        return;
      }
      setPdfUploading(true);
      const formData = new FormData();
      formData.append('menuPdf', {
        uri: asset.uri,
        type: 'application/pdf',
        name: asset.name || 'document.pdf',
      });
      const res = await apiFetch('/api/upload-menu-pdf', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        appendFile({ type: 'pdf', url: data.url, name: '' });
      } else {
        Alert.alert(tx('Hata'), data.error || 'PDF yüklenemedi');
      }
    } catch (e) {
      Alert.alert(tx('Hata'), 'PDF seçilemedi veya yüklenemedi');
    } finally {
      setPdfUploading(false);
    }
  };

  const uploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tx('İzin'), 'Galeri erişimi gerekli.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setImageUploading(true);
      const formData = new FormData();
      formData.append('image', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      const res = await apiFetch('/api/upload/image', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        appendFile({ type: 'image', url: data.url, name: '' });
      } else {
        Alert.alert(tx('Hata'), data.error || 'Yüklenemedi');
      }
    } catch (e) {
      Alert.alert(tx('Hata'), 'Dosya yüklenemedi');
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>
        Küçük resme dokunarak sırayla gezin. Kaldırmak için ✕, kaydetmek için alttaki Kaydet.
      </Text>

      {files.length === 0 ? (
        <Text style={styles.emptyText}>Henüz dosya yok.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbStrip}
        >
          {files.map((file, index) => (
            <View key={`${file.url}-${index}`} style={styles.thumbWrap}>
              <TouchableOpacity onPress={() => openGalleryAt(index)} activeOpacity={0.85}>
                {file.type === 'image' ? (
                  <Image source={{ uri: apiUrl(file.url) }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={styles.mediaThumb}>
                    <Text style={styles.mediaIcon}>
                      {file.type === 'video' ? '▶️' : '📄'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeIcon} onPress={() => removeAt(index)}>
                <Text style={styles.removeIconText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.uploadBtn, imageUploading && styles.uploadBtnDisabled]}
        onPress={uploadImage}
        disabled={imageUploading}
      >
        {imageUploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.uploadBtnText}>Fotoğraf ekle</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.uploadBtn, styles.uploadBtnSecondary, pdfUploading && styles.uploadBtnDisabled]}
        onPress={uploadPdf}
        disabled={pdfUploading}
      >
        {pdfUploading ? (
          <ActivityIndicator color="#1B4D4A" size="small" />
        ) : (
          <Text style={[styles.uploadBtnText, styles.uploadBtnTextSecondary]}>PDF ekle</Text>
        )}
      </TouchableOpacity>

      <ListingMediaGalleryModal
        visible={galleryVisible}
        items={galleryItems}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  hint: { fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 18 },
  emptyText: { fontSize: 13, color: '#999', marginBottom: 12, fontStyle: 'italic' },
  thumbStrip: { paddingVertical: 4, gap: 10, paddingRight: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#eee' },
  mediaThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#e8f4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaIcon: { fontSize: 32 },
  removeIcon: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIconText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  uploadBtn: {
    backgroundColor: '#1B4D4A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  uploadBtnSecondary: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#1B4D4A' },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  uploadBtnTextSecondary: { color: '#1B4D4A' },
});
