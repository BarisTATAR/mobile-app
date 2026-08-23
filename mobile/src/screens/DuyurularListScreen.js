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
  Image,
  Linking,
  Alert,
} from 'react-native';
import { apiUrl } from '../config/api';
import { getProvinces, getDistrictsForProvince, getNeighborhoods, DEFAULT_CITY } from '../services/turkeyAddressService';
import { buildListAddressQueryParams } from '../utils/listAddressQueryParams';
import { useUserDefaultDistrict } from '../hooks/useUserDefaultDistrict';

const MUGLA_DISTRICTS_FALLBACK = ['Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris', 'Menteşe', 'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan'];

/** Sunucudan gelen /uploads/... veya tam http(s) URL */
function resolveListImageUri(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return apiUrl(s.startsWith('/') ? s : `/${s}`);
}

function kampanyaDisplayBusinessName(item) {
  const c = item.companyName != null && String(item.companyName).trim();
  if (c) return c;
  if (item.premiumOwner?.displayName) return String(item.premiumOwner.displayName).trim();
  return item.business?.businessName ? String(item.business.businessName).trim() : '';
}

function kampanyaDisplayPhone(item) {
  const p = item.contactPhone != null && String(item.contactPhone).trim();
  if (p) return p;
  if (item.premiumOwner?.phone) return String(item.premiumOwner.phone).trim();
  return item.business?.phone ? String(item.business.phone).trim() : '';
}

function duyuruDisplayBusinessName(item) {
  const c = item.companyName != null && String(item.companyName).trim();
  if (c) return c;
  if (item.business?.businessName) return String(item.business.businessName).trim();
  const yLogin = item.yoreselLoginName != null ? String(item.yoreselLoginName).trim() : '';
  if (yLogin) return yLogin;
  if (item.yoreselIsletme) {
    const login = item.yoreselIsletme.loginName != null ? String(item.yoreselIsletme.loginName).trim() : '';
    if (login) return login;
    if (item.yoreselIsletme.name) return String(item.yoreselIsletme.name).trim();
  }
  return '';
}

function duyuruDisplayPhone(item) {
  const p = item.contactPhone != null && String(item.contactPhone).trim();
  if (p) return p;
  if (item.business?.phone) return String(item.business.phone).trim();
  const yPhone = item.yoreselPhone != null ? String(item.yoreselPhone).trim() : '';
  if (yPhone) return yPhone;
  if (item.yoreselIsletme?.phone) return String(item.yoreselIsletme.phone).trim();
  return '';
}

export default function DuyurularListScreen({ navigation, route }) {
  const isKampanya = route?.params?.mode === 'kampanya';
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
  const [imageModalUri, setImageModalUri] = useState(null);

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

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildListAddressQueryParams(district, neighborhood);
      const path = isKampanya ? '/api/kampanyalar' : '/api/duyurular';
      const url = apiUrl(path + (params.toString() ? `?${params.toString()}` : ''));
      const res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      setList(res.ok && Array.isArray(data.list) ? data.list : []);
    } catch (e) {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [district, neighborhood, isKampanya]);

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
    return '—';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isKampanya ? 'Kampanyalar/İndirimler' : 'Duyurular'}</Text>
        <Text style={styles.subtitle}>İlçe ve mahalleye göre filtreleyin</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filtre</Text>
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
        <TouchableOpacity style={styles.filterBtn} onPress={loadList} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.filterBtnText}>Listele</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const imgUri = resolveListImageUri(item.imageUrl);
          if (isKampanya) {
            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTextBlock}>
                    <Text style={styles.titleText}>{item.title}</Text>
                    {item.discountText ? <Text style={styles.discount}>{item.discountText}</Text> : null}
                    {kampanyaDisplayBusinessName(item) ? (
                      <Text style={styles.companyLine}>İşletme adı: {kampanyaDisplayBusinessName(item)}</Text>
                    ) : null}
                    {kampanyaDisplayPhone(item) ? (
                      <TouchableOpacity
                        onPress={() => {
                          const tel = kampanyaDisplayPhone(item).replace(/\s/g, '');
                          Alert.alert('Aransın mı?', kampanyaDisplayPhone(item), [
                            { text: 'İptal', style: 'cancel' },
                            { text: 'Ara', onPress: () => Linking.openURL(`tel:${tel}`) },
                          ]);
                        }}
                        activeOpacity={0.7}
                        style={styles.phoneTouch}
                      >
                        <Text style={styles.phoneLine}>📞 {kampanyaDisplayPhone(item)}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {item.startDate ? (
                      <Text style={styles.dates}>Kampanya başlangıç tarihi: {item.startDate}</Text>
                    ) : null}
                    {item.licenseExpiry ? (
                      <Text style={styles.licenseLine}>Kampanya bitiş tarihi: {item.licenseExpiry}</Text>
                    ) : null}
                    {addr(item) !== '—' ? <Text style={styles.address}>{addr(item)}</Text> : null}
                  </View>
                  {imgUri ? (
                    <TouchableOpacity
                      style={styles.cardImageColumn}
                      onPress={() => setImageModalUri(imgUri)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.cardImageFrame}>
                        <Image source={{ uri: imgUri }} style={styles.cardThumb} resizeMode="cover" />
                      </View>
                      <Text style={styles.cardImageHint}>Büyüt</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }
          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTextBlock}>
                  <Text style={styles.titleText}>{item.title}</Text>
                  {item.description ? <Text style={styles.description} numberOfLines={3}>{item.description}</Text> : null}
                  {(item.startDate || item.endDate) ? (
                    <Text style={styles.dates}>{[item.startDate, item.endDate].filter(Boolean).join(' – ')}</Text>
                  ) : null}
                  {addr(item) !== '—' ? <Text style={styles.address}>{addr(item)}</Text> : null}
                  {duyuruDisplayBusinessName(item) ? (
                    <Text style={styles.business}>İşletme: {duyuruDisplayBusinessName(item)}</Text>
                  ) : null}
                  {duyuruDisplayPhone(item) ? (
                    <TouchableOpacity
                      onPress={() => {
                        const tel = duyuruDisplayPhone(item).replace(/\s/g, '');
                        Alert.alert('Aransın mı?', duyuruDisplayPhone(item), [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Ara', onPress: () => Linking.openURL(`tel:${tel}`) },
                        ]);
                      }}
                      activeOpacity={0.7}
                      style={styles.phoneTouch}
                    >
                      <Text style={styles.phoneLine}>📞 {duyuruDisplayPhone(item)}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {imgUri ? (
                  <TouchableOpacity
                    style={styles.cardImageColumn}
                    onPress={() => setImageModalUri(imgUri)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.cardImageFrame}>
                      <Image source={{ uri: imgUri }} style={styles.cardThumb} resizeMode="cover" />
                    </View>
                    <Text style={styles.cardImageHint}>Büyüt</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>{isKampanya ? 'Bu filtreye uygun kampanya yok.' : 'Bu filtreye uygun duyuru yok.'}</Text> : null}
      />

      <Modal visible={!!imageModalUri} transparent animationType="fade" onRequestClose={() => setImageModalUri(null)}>
        <TouchableOpacity style={styles.imageModalOverlay} activeOpacity={1} onPress={() => setImageModalUri(null)}>
          <View style={styles.imageModalInner} onStartShouldSetResponder={() => true}>
            {imageModalUri ? (
              <Image source={{ uri: imageModalUri }} style={styles.imageModalImage} resizeMode="contain" />
            ) : null}
            <TouchableOpacity style={styles.imageModalCloseBtn} onPress={() => setImageModalUri(null)}>
              <Text style={styles.imageModalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={districtModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDistrictModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>İlçe seçin</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setDistrict(''); setNeighborhood(''); setDistrictModal(false); }}>
              <Text style={styles.modalItemText}>Tümü</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {districts.map((d) => (
                <TouchableOpacity key={d} style={styles.modalItem} onPress={() => { setDistrict(d); setNeighborhood(''); setDistrictModal(false); }}>
                  <Text style={styles.modalItemText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDistrictModal(false)}><Text style={styles.modalCloseText}>Kapat</Text></TouchableOpacity>
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
                <TouchableOpacity key={n} style={styles.modalItem} onPress={() => { setNeighborhood(n); setNeighborhoodModal(false); }}>
                  <Text style={styles.modalItemText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setNeighborhoodModal(false)}><Text style={styles.modalCloseText}>Kapat</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#34C759', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { position: 'absolute', top: 52, left: 16, padding: 8, zIndex: 1 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' },
  filterSection: { backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  filterTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 10, marginBottom: 6 },
  selectTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12 },
  selectText: { fontSize: 15, color: '#333' },
  selectPlaceholder: { color: '#888' },
  selectArrow: { fontSize: 12, color: '#666' },
  filterBtn: { marginTop: 16, backgroundColor: '#34C759', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  filterBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 24, paddingHorizontal: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTextBlock: { flex: 1, minWidth: 0 },
  /* Taksi listesi ile aynı önizleme: 80×80, dokununca modalda büyüt */
  cardImageColumn: { marginLeft: 12, alignItems: 'center' },
  cardImageFrame: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee' },
  cardThumb: { width: '100%', height: '100%' },
  cardImageHint: { fontSize: 10, color: '#34C759', textAlign: 'center', marginTop: 2 },
  licenseLine: { fontSize: 12, color: '#e65100', fontWeight: '600', marginBottom: 2 },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  imageModalInner: { width: '100%', alignItems: 'center' },
  imageModalImage: { width: '100%', height: 400 },
  imageModalCloseBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#34C759', borderRadius: 10 },
  imageModalCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  titleText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  discount: { fontSize: 14, color: '#34C759', fontWeight: '600', marginBottom: 4 },
  description: { fontSize: 13, color: '#666', marginBottom: 2 },
  companyLine: { fontSize: 14, color: '#333', fontWeight: '600', marginBottom: 4 },
  phoneTouch: { alignSelf: 'flex-start', marginBottom: 4 },
  phoneLine: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  dates: { fontSize: 12, color: '#888', marginBottom: 2 },
  address: { fontSize: 12, color: '#888', marginBottom: 2 },
  business: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalScroll: { maxHeight: 320 },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
});
