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
import { buildListAddressQueryParams, formatListFilterLabel, formatListCountStatus } from '../utils/listAddressQueryParams';
import ViewModeToggle from '../components/ViewModeToggle';
import NearbySortButton from '../components/NearbySortButton';
import ListMapView from '../components/ListMapView';
import ListingHoursMenu from '../components/ListingHoursMenu';
import ListingCardMedia from '../components/ListingCardMedia';
import ListingMediaGalleryModal from '../components/ListingMediaGalleryModal';
import { pinAppearanceForCekici } from '../utils/mapMarkerColors';
import { useNearbySort } from '../hooks/useNearbySort';
import { useUserDefaultDistrict } from '../hooks/useUserDefaultDistrict';
import { useLanguage } from '../i18n/LanguageContext';


const MUGLA_DISTRICTS_FALLBACK = ['Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris', 'Menteşe', 'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan'];

export default function CekiciListScreen({ navigation }) {
  const { tx } = useLanguage();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  useUserDefaultDistrict(setDistrict);
  const [districtModal, setDistrictModal] = useState(false);
  const [neighborhoodModal, setNeighborhoodModal] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const [listError, setListError] = useState(null);
  const {
    displayList,
    sortByNearby,
    locationLoading,
    toggleNearbySort,
    distanceLabel,
  } = useNearbySort(list);

  const openGallery = useCallback((items, index = 0) => {
    if (!items?.length) return;
    setGalleryItems(items);
    setGalleryIndex(index);
    setGalleryVisible(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getProvinces().then((p) => { if (!cancelled) setProvinces(p); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const districtList = getDistrictsForProvince(provinces, DEFAULT_CITY);
    if (districtList.length > 0) setDistricts(districtList.map((d) => d.name));
    else setDistricts(MUGLA_DISTRICTS_FALLBACK);
  }, [provinces]);

  useEffect(() => {
    if (!district) {
      setNeighborhoods([]);
      setNeighborhood('');
      return;
    }
    let cancelled = false;
    getNeighborhoods(DEFAULT_CITY, district).then((arr) => {
      if (cancelled) return;
      const names = Array.isArray(arr) ? arr.map((n) => (typeof n === 'object' ? n.name : n)).filter(Boolean) : [];
      setNeighborhoods(names);
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

  const filterLabel = formatListFilterLabel(district, neighborhood);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = buildListAddressQueryParams(district, neighborhood, { forMap: viewMode === 'map' });
      const path = '/api/cekici' + (params.toString() ? `?${params.toString()}` : '');
      const res = await apiFetch(path, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setList([]);
        setListError(data.error || 'Liste alınamadı');
        return;
      }
      setList(Array.isArray(data.list) ? data.list : []);
    } catch (e) {
      setList([]);
      setListError('Sunucuya bağlanılamadı. Backend çalışıyor mu? (cd backend && npm start)');
    } finally {
      setLoading(false);
    }
  }, [district, neighborhood, viewMode]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  }, [loadList]);

  const addr = (item) => {
    const a = item.address;
    if (a && (a.city || a.district || a.neighborhood)) {
      return [a.city, a.district, a.neighborhood].filter(Boolean).join(', ');
    }
    return [item.city, item.district].filter(Boolean).join(', ') || '—';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← {tx('Geri')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{tx('Çekici')}</Text>
        <Text style={styles.subtitle}>{tx('İlçe ve mahalleye göre filtreleyin')}</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>{tx('Filtre')}</Text>
        <Text style={styles.filterLabel}>{tx('İlçe')}</Text>
        <TouchableOpacity style={styles.selectTouch} onPress={() => setDistrictModal(true)}>
          <Text style={[styles.selectText, !district && styles.selectPlaceholder]}>{district || tx('Tümü')}</Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>
        <Text style={styles.filterLabel}>{tx('Mahalle')}</Text>
        <TouchableOpacity style={styles.selectTouch} onPress={() => district && setNeighborhoodModal(true)} disabled={!district}>
          <Text style={[styles.selectText, !neighborhood && styles.selectPlaceholder]}>{neighborhood || tx('Tümü')}</Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>
        <View style={styles.listeleRow}>
          <TouchableOpacity style={styles.filterBtn} onPress={loadList} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.filterBtnText}>{tx('Listele')}</Text>}
          </TouchableOpacity>
        </View>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        <NearbySortButton
          active={sortByNearby}
          loading={locationLoading}
          onPress={toggleNearbySort}
        />
        {listError ? <Text style={styles.listErrorText}>{listError}</Text> : null}
        {!listError && !loading ? (
          <Text style={styles.listStatusText}>
            {formatListCountStatus(filterLabel, list.length)}
          </Text>
        ) : null}
      </View>

      <View style={styles.contentBody}>
      {viewMode === 'map' ? (
        <View style={styles.mapWrap}>
        <ListMapView
          items={displayList}
          getItemId={(item) => item._id}
          getItemTitle={(item) => item.companyName}
          getItemPhone={(item) => item.phone}
          getPinAppearance={pinAppearanceForCekici}
          defaultDistrict={district}
        />
        </View>
      ) : (
      <FlatList
        style={styles.listFlex}
        data={displayList}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.name}>{item.companyName}</Text>
                {distanceLabel(item) ? (
                  <Text style={styles.distanceText}>📍 {distanceLabel(item)}</Text>
                ) : null}
                {item.phone ? (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(tx('Aransın mı?'), item.phone, [
                        { text: tx('İptal'), style: 'cancel' },
                        { text: tx('Ara'), onPress: () => Linking.openURL('tel:' + item.phone.replace(/\s/g, '')) },
                      ]);
                    }}
                    activeOpacity={0.7}
                    style={styles.phoneTouch}
                  >
                    <Text style={styles.phone}>📞 {item.phone}</Text>
                  </TouchableOpacity>
                ) : null}
                {addr(item) !== '—' ? <Text style={styles.address}>📍 {addr(item)}</Text> : null}
                <ListingHoursMenu item={item} />
                {item.notes ? <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text> : null}
              </View>
              <ListingCardMedia
                item={item}
                onOpenGallery={openGallery}
                imageWrapStyle={styles.cardImageWrap}
                thumbStyle={styles.cardThumb}
              />
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />}
        ListEmptyComponent={
          !loading && !listError ? (
            <Text style={styles.emptyText}>
              {district || neighborhood
                ? tx('{place} için kayıt bulunamadı. İlçe/mahalle seçimini kontrol edin veya Tümü deneyin.', { place: filterLabel })
                : tx('Henüz kayıt yok.')}
            </Text>
          ) : null
        }
      />
      )}
      </View>

      <ListingMediaGalleryModal
        visible={galleryVisible}
        items={galleryItems}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />

      <Modal visible={districtModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDistrictModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tx('İlçe seçin')}</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setDistrict(''); setNeighborhood(''); setDistrictModal(false); }}>
              <Text style={styles.modalItemText}>{tx('Tümü')}</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {districts.map((d) => (
                <TouchableOpacity key={d} style={styles.modalItem} onPress={() => { setDistrict(d); setNeighborhood(''); setDistrictModal(false); }}>
                  <Text style={styles.modalItemText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDistrictModal(false)}><Text style={styles.modalCloseText}>{tx('Kapat')}</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={neighborhoodModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNeighborhoodModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{tx('Mahalle seçin')}</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setNeighborhood(''); setNeighborhoodModal(false); }}>
              <Text style={styles.modalItemText}>{tx('Tümü')}</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {neighborhoods.map((n) => (
                <TouchableOpacity key={n} style={styles.modalItem} onPress={() => { setNeighborhood(n); setNeighborhoodModal(false); }}>
                  <Text style={styles.modalItemText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setNeighborhoodModal(false)}><Text style={styles.modalCloseText}>{tx('Kapat')}</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  header: { backgroundColor: '#1B4D4A', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { position: 'absolute', top: 52, left: 16, padding: 8, zIndex: 1 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' },
  filterSection: { backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  listeleRow: { marginTop: 12 },
  listErrorText: { marginTop: 8, fontSize: 13, color: '#c62828', fontWeight: '600' },
  listStatusText: { marginTop: 8, fontSize: 13, color: '#555', fontWeight: '600' },
  contentBody: { flex: 1, minHeight: 0 },
  mapWrap: { flex: 1, minHeight: 360, marginHorizontal: 16, marginBottom: 16 },
  listFlex: { flex: 1 },
  filterTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 10, marginBottom: 6 },
  selectTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F4F1EB', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12 },
  selectText: { fontSize: 15, color: '#333' },
  selectPlaceholder: { color: '#888' },
  selectArrow: { fontSize: 12, color: '#666' },
  filterBtn: { backgroundColor: '#1B4D4A', paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  filterBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 24, paddingHorizontal: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTextBlock: { flex: 1, minWidth: 0 },
  cardImageWrap: { alignItems: 'center' },
  cardThumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#eee' },
  cardImageHint: { fontSize: 10, color: '#1B4D4A', marginTop: 4 },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  imageModalInner: { width: '100%', alignItems: 'center' },
  imageModalImage: { width: '100%', height: 400 },
  imageModalCloseBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#1B4D4A', borderRadius: 10 },
  imageModalCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  name: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  distanceText: { fontSize: 13, fontWeight: '600', color: '#1565c0', marginBottom: 4 },
  phone: { fontSize: 14, color: '#555', marginBottom: 2 },
  phoneTouch: { alignSelf: 'flex-start', marginBottom: 2 },
  address: { fontSize: 13, color: '#666', marginBottom: 2 },
  notes: { fontSize: 13, color: '#888', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalScroll: { maxHeight: 320 },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#1B4D4A' },
});
