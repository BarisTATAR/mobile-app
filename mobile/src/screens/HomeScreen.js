import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { warmupAfterFirstPaint } from '../services/appWarmup';

// 1. grup: Duyurular
const DUYURULAR_GRUP = [
  { id: 'duyurular', label: 'Duyurular', emoji: '📢' },
  { id: 'kampanyalar', label: 'Kampanyalar/İndirimler', emoji: '🏷️' },
];
// Ortada: hızlı erişim (grup başlığı yok)
const MENU_ITEMS = [
  { id: 'rezervasyon', label: 'Rezervasyon', emoji: '📅' },
  { id: 'etkinlikler', label: 'Yöresel Etkinlikler', emoji: '🎊' },
  { id: 'esnaf', label: 'Esnaf', emoji: '🏪' },
  { id: 'hava', label: 'Hava Durumu', emoji: '🌤️' },
  { id: 'eczane', label: 'Nöbetçi Eczane', emoji: '💊' },
  { id: 'cekici', label: 'Çekici', emoji: '🚗' },
  { id: 'lastikci', label: 'Lastikçim', emoji: '🛞' },
  { id: 'taksi', label: 'Taksi', emoji: '🚕' },
];
// En altta: İş ilanları
const IS_ILANLARI_GRUP = [
  { id: 'isilanlari', label: 'İş ilanları', emoji: '💼' },
];

const GUEST_ALLOWED = new Set(['duyurular', 'hava', 'eczane']);

export default function HomeScreen({ navigation, route }) {
  const isGuest = route?.params?.guest === true;

  useEffect(() => {
    warmupAfterFirstPaint();
  }, []);

  const handlePress = (item) => {
    if (isGuest && !GUEST_ALLOWED.has(item.id)) {
      Alert.alert(
        'Üye girişi gerekli',
        'Rezervasyon ve talepler için üye olmalısınız.',
        [
          { text: 'Tamam', style: 'cancel' },
          { text: 'Giriş yap', onPress: () => navigation.replace('Login') },
        ]
      );
      return;
    }
    if (item.id === 'rezervasyon') {
      navigation.navigate('BusinessList');
      return;
    }
    if (item.id === 'esnaf') {
      navigation.navigate('EsnafList');
      return;
    }
    if (item.id === 'etkinlikler') {
      navigation.navigate('Etkinlikler');
      return;
    }
    if (item.id === 'eczane') {
      navigation.navigate('PharmacyOnDuty');
      return;
    }
    if (item.id === 'hava') {
      navigation.navigate('Weather');
      return;
    }
    if (item.id === 'duyurular') {
      navigation.navigate('DuyurularList');
      return;
    }
    if (item.id === 'isilanlari') {
      navigation.navigate('IsIlanlariList');
      return;
    }
    if (item.id === 'kampanyalar') {
      navigation.navigate('DuyurularList', { mode: 'kampanya' });
      return;
    }
    if (item.id === 'cekici') {
      navigation.navigate('CekiciList');
      return;
    }
    if (item.id === 'lastikci') {
      navigation.navigate('LastikciList');
      return;
    }
    if (item.id === 'taksi') {
      navigation.navigate('TaksiList');
      return;
    }
    Alert.alert(item.label, `${item.label} seçildi. (Ekran yakında eklenecek)`);
  };

  const renderCard = (item) => {
    const disabled = isGuest && !GUEST_ALLOWED.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        testID={`home-card-${item.id}`}
        style={[styles.card, disabled && styles.cardDisabled]}
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.logoCircle, disabled && styles.logoCircleDisabled]}>
          <Text style={[styles.emoji, disabled && styles.emojiDisabled]}>{item.emoji}</Text>
        </View>
        <Text style={[styles.cardLabel, disabled && styles.cardLabelDisabled]} numberOfLines={2}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>48 App</Text>
        <Text style={styles.subtitle}>Hızlı erişim</Text>
      </View>
      {isGuest && (
        <TouchableOpacity
          style={styles.guestBanner}
          onPress={() => navigation.replace('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.guestBannerText}>Misafir olarak geziniyorsunuz · Giriş yap</Text>
        </TouchableOpacity>
      )}

      <View style={styles.grid}>
        {DUYURULAR_GRUP.map(renderCard)}
        {MENU_ITEMS.map(renderCard)}
        {IS_ILANLARI_GRUP.map(renderCard)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f9f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 32,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  guestBanner: {
    backgroundColor: '#FFF3CD',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  guestBannerText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '600',
  },
  cardDisabled: {
    opacity: 0.45,
  },
  logoCircleDisabled: {
    backgroundColor: '#e8e8e8',
  },
  emojiDisabled: {
    opacity: 0.5,
  },
  cardLabelDisabled: {
    color: '#aaa',
  },
});
