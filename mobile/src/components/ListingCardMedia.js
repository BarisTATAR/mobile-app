import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { apiUrl } from '../config/api';
import { listingGalleryItems } from '../utils/listingMedia';

export default function ListingCardMedia({ item, onOpenGallery, imageWrapStyle, thumbStyle }) {
  const galleryItems = listingGalleryItems(item);
  if (!galleryItems.length) return null;

  const slides = galleryItems.map((f) => ({
    type: f.type,
    url: apiUrl(f.url),
  }));

  const previewImage = galleryItems.find((f) => f.type === 'image');
  const previewUri = previewImage ? apiUrl(previewImage.url) : null;

  return (
    <TouchableOpacity
      style={[styles.wrap, imageWrapStyle]}
      onPress={() => onOpenGallery?.(slides, 0)}
      activeOpacity={0.9}
    >
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={[styles.thumb, thumbStyle]} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.pdfThumb, thumbStyle]}>
          <Text style={styles.pdfIcon}>{galleryItems[0]?.type === 'video' ? '▶️' : '📄'}</Text>
        </View>
      )}
      {slides.length > 1 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {slides.length > 1 ? `1/${slides.length}` : ''}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  thumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: '#eee' },
  pdfThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f4ff' },
  pdfIcon: { fontSize: 32 },
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
