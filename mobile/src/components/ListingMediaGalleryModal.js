import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ListingMediaGalleryModal({
  visible,
  items,
  images,
  initialIndex = 0,
  onClose,
}) {
  const scrollRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const slides = useMemo(() => {
    if (Array.isArray(items) && items.length) return items;
    return (images || []).map((uri) => ({ type: 'image', url: uri }));
  }, [items, images]);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_WIDTH, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [visible, initialIndex, slides.length]);

  const openPdf = (url) => {
    Linking.openURL(url).catch(() => Alert.alert('Hata', 'PDF açılamadı.'));
  };

  const onScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_WIDTH);
    setCurrentIndex(Math.max(0, Math.min(idx, slides.length - 1)));
  };

  if (!visible || !slides.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.overlay}>
          {slides.length > 1 ? (
            <Text style={styles.counter}>
              {currentIndex + 1} / {slides.length}
            </Text>
          ) : null}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
            onMomentumScrollEnd={onScrollEnd}
          >
            {slides.map((slide, index) => (
              <View key={`${slide.url}-${index}`} style={styles.slide}>
                {slide.type === 'pdf' ? (
                  <TouchableOpacity
                    style={styles.mediaSlide}
                    onPress={() => openPdf(slide.url)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.mediaIcon}>📄</Text>
                  </TouchableOpacity>
                ) : slide.type === 'video' ? (
                  <TouchableOpacity
                    style={styles.mediaSlide}
                    onPress={() => Linking.openURL(slide.url).catch(() => {})}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.mediaIcon}>▶️</Text>
                  </TouchableOpacity>
                ) : (
                  <Image source={{ uri: slide.url }} style={styles.image} resizeMode="contain" />
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  counter: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  scroll: { flexGrow: 0 },
  slide: {
    width: SCREEN_WIDTH,
    height: '68%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: SCREEN_WIDTH - 32, height: '100%' },
  mediaSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  mediaIcon: { fontSize: 64 },
  closeBtn: {
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  closeBtnText: { fontSize: 16, fontWeight: '600', color: '#222' },
});
