import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { apiUrl, apiFetch } from '../config/api';
import { getProvinces, getDistrictsForProvince, getNeighborhoods, DEFAULT_CITY } from '../services/turkeyAddressService';
import { buildListAddressQueryParams } from '../utils/listAddressQueryParams';
import ViewModeToggle from '../components/ViewModeToggle';
import ListMapView from '../components/ListMapView';
import ListingHoursMenu from '../components/ListingHoursMenu';
import ListingCardMedia from '../components/ListingCardMedia';
import ListingMediaGalleryModal from '../components/ListingMediaGalleryModal';
import { pinAppearanceForEsnaf, esnafCategoryLabel, esnafCategoryIcon, ESNAF_CATEGORY_FILTER_OPTIONS } from '../utils/mapMarkerColors';
import { useUserDefaultDistrict } from '../hooks/useUserDefaultDistrict';

// API yanıt vermezse kullanılacak Muğla ilçeleri (ilçe her zaman seçilebilir olsun)
const MUGLA_DISTRICTS_FALLBACK = ['Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris', 'Menteşe', 'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan'];

export default function EsnafListScreen({ navigation }) {
  const [esnaflar, setEsnaflar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  useUserDefaultDistrict(setDistrict);
  const [category, setCategory] = useState('');
  const [districtModal, setDistrictModal] = useState(false);
  const [neighborhoodModal, setNeighborhoodModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const [listError, setListError] = useState(null);

  const openGallery = useCallback((items, index = 0) => {
    if (!items?.length) return;
    setGalleryItems(items);
    setGalleryIndex(index);
    setGalleryVisible(true);
  }, []);

  const loadDistricts = useCallback(async () => {
    try {
      const provList = await getProvinces();
      const districtList = getDistrictsForProvince(provList, DEFAULT_CITY);
      const names = districtList.length > 0 ? districtList.map((d) => d.name) : MUGLA_DISTRICTS_FALLBACK;
      setDistricts(names);
    } catch (e) {
      setDistricts(MUGLA_DISTRICTS_FALLBACK);
    }
  }, []);

  // Kategori listesi: API'den (veritabanındaki mevcut kategoriler)
  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch('/api/esnaf/filters', { method: 'GET', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
    } catch (e) {
      setCategories([]);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      await Promise.all([loadDistricts(), loadCategories()]);
    } finally {
      setFiltersReady(true);
    }
  }, [loadDistricts, loadCategories]);

  useEffect(() => {
    if (!district) {
      setNeighborhoods([]);
      setNeighborhood('');
      return;
    }
    let cancelled = false;
    getNeighborhoods(DEFAULT_CITY, district).then((list) => {
      if (cancelled) return;
      const arr = Array.isArray(list) ? list : [];
      setNeighborhoods(arr);
      const names = arr.map((n) => (typeof n === 'object' && n != null ? n.name : n)).filter(Boolean);
      setNeighborhood((prev) => {
        const p = (prev || '').trim();
        if (!p) return '';
        return names.includes(p) ? prev : '';
      });
    }).catch(() => {
      if (!cancelled) {
        setNeighborhoods([]);
        setNeighborhood('');
      }
    });
    return () => { cancelled = true; };
  }, [district]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = buildListAddressQueryParams(district, neighborhood, { forMap: viewMode === 'map' });
      if (category) params.set('category', category.trim());
      const path = '/api/esnaf' + (params.toString() ? `?${params.toString()}` : '');
      const res = await apiFetch(path, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEsnaflar([]);
        setListError(data.error || 'Liste alınamadı');
        return;
      }
      setEsnaflar(Array.isArray(data.esnaflar) ? data.esnaflar : []);
    } catch (e) {
      setEsnaflar([]);
      setListError('Sunucuya bağlanılamadı. Backend: cd backend && npm start');
    } finally {
      setLoading(false);
    }
  }, [district, neighborhood, category, viewMode]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    if (filtersReady) loadList();
  }, [filtersReady, district, neighborhood, category, loadList]);

  useEffect(() => {
    if (filtersReady) loadDistricts();
  }, [filtersReady, loadDistricts]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadFilters();
    await loadList();
    setRefreshing(false);
  }, [loadFilters, loadList]);

  const renderItem = ({ item }) => {
    const addr = item.address;
    const addrStr = [addr?.city, addr?.district, addr?.neighborhood].filter(Boolean).join(', ') || '—';
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTextBlock}>
            <Text style={styles.name}>{item.name}</Text>
            {item.category ? (
              <Text style={styles.category}>
                {esnafCategoryIcon(item.category) ? `${esnafCategoryIcon(item.category)} ` : ''}{item.category}
              </Text>
            ) : null}
            {item.phone ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Aransın mı?', item.phone, [
                    { text: 'İptal', style: 'cancel' },
                    { text: 'Ara', onPress: () => Linking.openURL('tel:' + item.phone.replace(/\s/g, '')) },
                  ]);
                }}
                activeOpacity={0.7}
                style={styles.phoneTouch}
              >
                <Text style={styles.phone}>📞 {item.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {addrStr !== '—' ? <Text style={styles.address}>{addrStr}</Text> : null}
            <ListingHoursMenu item={item} />
            {item.description ? <Text style={styles.description} numberOfLines={3}>{item.description}</Text> : null}
          </View>
          <ListingCardMedia
            item={item}
            onOpenGallery={openGallery}
            imageWrapStyle={styles.cardImageWrap}
            thumbStyle={styles.cardThumb}
          />
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.listHeaderRoot}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Esnaf</Text>
        <Text style={styles.subtitle}>
          Aşağı kaydırarak filtreleri yukarı alın; esnaf listesinde daha fazla yer açılır.
        </Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filtre (yukarı kaydırılabilir)</Text>

        <Text style={styles.filterLabel}>İlçe</Text>
        <TouchableOpacity style={styles.selectTouch} onPress={() => setDistrictModal(true)}>
          <Text style={[styles.selectText, !district && styles.selectPlaceholder]}>{district || 'Tümü'}</Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.filterLabel}>Mahalle</Text>
        <TouchableOpacity style={styles.selectTouch} onPress={() => district && setNeighborhoodModal(true)} disabled={!district}>
          <Text style={[styles.selectText, !neighborhood && styles.selectPlaceholder]}>{neighborhood || 'Tümü'}</Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.filterLabel}>Kategori</Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.categoryChipScroll}
          contentContainerStyle={styles.categoryChipContent}
        >
          {ESNAF_CATEGORY_FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id || 'tumu'}
              style={[styles.categoryChip, category === opt.id && styles.categoryChipActive]}
              onPress={() => setCategory(opt.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryChipText, category === opt.id && styles.categoryChipTextActive]}>
                {opt.icon ? `${opt.icon} ` : ''}{opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.listeleRow}>
          <TouchableOpacity style={styles.filterBtn} onPress={loadList} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.filterBtnText}>Listele</Text>}
          </TouchableOpacity>
        </View>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        {listError ? <Text style={styles.listErrorText}>{listError}</Text> : null}
      </View>

      {viewMode === 'list' ? <Text style={styles.listSectionLabel}>Esnaflar</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {viewMode === 'map' ? (
        <>
          {listHeader}
          <View style={styles.mapWrap}>
            <ListMapView
              items={esnaflar}
              getItemId={(item) => item._id}
              getItemTitle={(item) => item.name}
              getItemPhone={(item) => item.phone}
              getPinAppearance={pinAppearanceForEsnaf}
              getMarkerSubtitle={esnafCategoryLabel}
              defaultDistrict={district}
            />
          </View>
        </>
      ) : (
      <FlatList
        data={esnaflar}
        extraData={esnaflar.length}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          esnaflar.length === 0 && !loading ? styles.listContentGrow : null,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {district || neighborhood || category ? 'Bu filtreye uygun esnaf yok.' : 'Henüz kayıtlı esnaf yok. Admin panelinden ekleyebilirsiniz.'}
            </Text>
          ) : null
        }
      />
      )}

      <Modal visible={districtModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDistrictModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>İlçe seçin</Text>
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                setDistrict('');
                setNeighborhood('');
                setDistrictModal(false);
              }}
            >
              <Text style={styles.modalItemText}>Tümü</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {districts.length === 0 ? (
                <Text style={styles.modalEmptyHint}>İlçe listesi yükleniyor...</Text>
              ) : (
                districts.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={styles.modalItem}
                    onPress={() => {
                      setDistrict(d);
                      setNeighborhood('');
                      setDistrictModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{d}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDistrictModal(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={neighborhoodModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNeighborhoodModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mahalle seçin</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setNeighborhood(''); setNeighborhoodModal(false); }}>
              <Text style={styles.modalItemText}>Tümü</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {neighborhoods.map((n) => (
                <TouchableOpacity key={typeof n === 'object' ? n.id || n.name : n} style={styles.modalItem} onPress={() => { setNeighborhood(typeof n === 'object' ? n.name : n); setNeighborhoodModal(false); }}>
                  <Text style={styles.modalItemText}>{typeof n === 'object' ? n.name : n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setNeighborhoodModal(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ListingMediaGalleryModal
        visible={galleryVisible}
        items={galleryItems}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />

      <Modal visible={categoryModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCategoryModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Kategori seçin</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setCategory(''); setCategoryModal(false); }}>
              <Text style={styles.modalItemText}>Tümü</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {categories.map((c) => {
                const icon = esnafCategoryIcon(c);
                return (
                <TouchableOpacity key={c} style={styles.modalItem} onPress={() => { setCategory(c); setCategoryModal(false); }}>
                  <Text style={styles.modalItemText}>{icon ? `${icon} ` : ''}{c}</Text>
                </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setCategoryModal(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  mapWrap: { flex: 1, minHeight: 360, marginHorizontal: 16, marginBottom: 16 },
  listHeaderRoot: { backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#34C759',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  backBtn: { position: 'absolute', top: 48, left: 16, padding: 8, zIndex: 1 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.88)', marginTop: 6, lineHeight: 17, textAlign: 'center' },
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  listeleRow: { marginTop: 12 },
  listErrorText: { marginTop: 8, fontSize: 13, color: '#c62828', fontWeight: '600' },
  filterTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 8 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 8, marginBottom: 4 },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectText: { fontSize: 15, color: '#333' },
  selectPlaceholder: { color: '#888' },
  selectArrow: { fontSize: 12, color: '#666' },
  categoryChipScroll: { marginTop: 2, marginBottom: 2 },
  categoryChipContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingRight: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#34C759', borderColor: '#2db34d' },
  categoryChipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  filterBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  filterBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  listSectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  listContent: { paddingBottom: 40 },
  listContentGrow: { flexGrow: 1 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 16, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTextBlock: { flex: 1, minWidth: 0 },
  cardImageWrap: { alignItems: 'center' },
  cardThumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#eee' },
  cardImageHint: { fontSize: 10, color: '#34C759', marginTop: 4 },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  imageModalInner: { width: '100%', alignItems: 'center' },
  imageModalImage: { width: '100%', height: 400 },
  imageModalCloseBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#34C759', borderRadius: 10 },
  imageModalCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  name: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  category: { fontSize: 14, color: '#34C759', fontWeight: '600', marginBottom: 6 },
  phone: { fontSize: 14, color: '#555', marginBottom: 2 },
  phoneTouch: { alignSelf: 'flex-start', marginBottom: 2 },
  address: { fontSize: 13, color: '#666', marginBottom: 2 },
  description: { fontSize: 13, color: '#888', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalScroll: { maxHeight: 320 },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalEmptyHint: { padding: 16, fontSize: 14, color: '#888', textAlign: 'center' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
});
