import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AnimatedSectionIcon from '../components/AnimatedSectionIcon';
import { warmupAfterFirstPaint } from '../services/appWarmup';
import { colors, shadow } from '../theme';
import { useLanguage } from '../i18n/LanguageContext';

// 1. grup: Duyurular
const DUYURULAR_GRUP = [
  { id: 'duyurular', label: 'Duyurular', emoji: '📢', motion: 'sway' },
  { id: 'kampanyalar', label: 'Kampanyalar/İndirimler', emoji: '🏷️', motion: 'pulse' },
];
// Ortada: hızlı erişim (grup başlığı yok)
const MENU_ITEMS = [
  { id: 'rezervasyon', label: 'Rezervasyon', emoji: '📅', motion: 'float' },
  { id: 'etkinlikler', label: 'Yöresel Etkinlikler', emoji: '🎊', motion: 'bounce' },
  { id: 'esnaf', label: 'Esnaf', emoji: '🏪', motion: 'float' },
  { id: 'hava', label: 'Hava Durumu', emoji: '🌤️', motion: 'float' },
  { id: 'eczane', label: 'Nöbetçi Eczane', emoji: '💊', motion: 'pulse' },
  { id: 'cekici', label: 'Çekici', emoji: '🚗', motion: 'sway' },
  { id: 'lastikci', label: 'Lastikçim', emoji: '🛞', motion: 'spin' },
  { id: 'taksi', label: 'Taksi', emoji: '🚕', motion: 'bounce' },
];
// En altta: İş ilanları
const IS_ILANLARI_GRUP = [
  { id: 'isilanlari', label: 'İş ilanları', emoji: '💼', motion: 'float' },
];

const GUEST_ALLOWED = new Set(['duyurular', 'hava', 'eczane']);

export default function HomeScreen({ navigation, route }) {
  const { tx, lang } = useLanguage();
  const isGuest = route?.params?.guest === true;
  const eventsLocked = lang === 'en';

  useEffect(() => {
    warmupAfterFirstPaint();
  }, []);

  const handlePress = (item) => {
    if (item.id === 'etkinlikler' && eventsLocked) {
      Alert.alert(
        tx('Yöresel Etkinlikler'),
        tx('Yöresel etkinlikler yalnızca Türkçe dilinde kullanılabilir.')
      );
      return;
    }
    if (isGuest && !GUEST_ALLOWED.has(item.id)) {
      Alert.alert(
        tx('Üye girişi gerekli'),
        tx('Rezervasyon ve talepler için üye olmalısınız.'),
        [
          { text: tx('Tamam'), style: 'cancel' },
          { text: tx('Giriş yap'), onPress: () => navigation.replace('Login') },
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

  const renderCard = (item, index) => {
    const disabled =
      (isGuest && !GUEST_ALLOWED.has(item.id)) || (item.id === 'etkinlikler' && eventsLocked);
    return (
      <TouchableOpacity
        key={item.id}
        testID={`home-card-${item.id}`}
        style={[styles.card, disabled && styles.cardDisabled]}
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.logoCircle, disabled && styles.logoCircleDisabled]}>
          <AnimatedSectionIcon
            emoji={item.emoji}
            motion={item.motion}
            disabled={disabled}
            delay={index * 160}
            style={[styles.emoji, disabled && styles.emojiDisabled]}
          />
        </View>
        <Text style={[styles.cardLabel, disabled && styles.cardLabelDisabled]} numberOfLines={2}>
          {tx(item.label)}
        </Text>
      </TouchableOpacity>
    );
  };

  const allCards = [...DUYURULAR_GRUP, ...MENU_ITEMS, ...IS_ILANLARI_GRUP];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Muğla</Text>
        <Text style={styles.title}>48 App</Text>
        <Text style={styles.subtitle}>{tx('Hizmetler ve rezervasyon')}</Text>
      </View>
      {isGuest && (
        <TouchableOpacity
          style={styles.guestBanner}
          onPress={() => navigation.replace('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.guestBannerText}>{tx('Misafir olarak geziniyorsunuz · Giriş yap')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.grid}>
        {allCards.map(renderCard)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 28,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  guestBanner: {
    backgroundColor: colors.warningSoft,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D7A8',
  },
  guestBannerText: {
    fontSize: 13,
    color: colors.warningText,
    fontWeight: '600',
  },
  cardDisabled: {
    opacity: 0.45,
  },
  logoCircleDisabled: {
    backgroundColor: '#E8E6E1',
  },
  emojiDisabled: {
    opacity: 0.5,
  },
  cardLabelDisabled: {
    color: '#A3A09A',
  },
});
