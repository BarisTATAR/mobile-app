import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { apiUrl } from '../config/api';
import { getLocationWithCityDistrict } from '../services/locationService';
import { getProvinces, getDistrictsForProvince, DEFAULT_CITY } from '../services/turkeyAddressService';
import { useUserDefaultDistrict } from '../hooks/useUserDefaultDistrict';

export default function PharmacyOnDutyScreen({ navigation }) {
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | loading | ok | error
  const [city, setCity] = useState(DEFAULT_CITY);
  const [district, setDistrict] = useState('');
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [districtsList, setDistrictsList] = useState([]);
  const [districtModal, setDistrictModal] = useState(false);
  const { appUser, districtDefaultReady } = useUserDefaultDistrict(setDistrict);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getProvinces();
      if (cancelled) return;
      const districts = getDistrictsForProvince(list, DEFAULT_CITY);
      setDistrictsList(districts);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchPharmacies = useCallback(async (cityName, districtName) => {
    if (!cityName) {
      setError('İl seçin.');
      setPharmacies([]);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ city: String(cityName).trim() });
      if (districtName && String(districtName).trim()) params.set('district', String(districtName).trim());
      const url = apiUrl('/api/pharmacies/on-duty?' + params.toString());
      const res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.pharmacies)) {
        setPharmacies(data.pharmacies);
        setCity(data.city || cityName);
        setDistrict(data.district != null ? data.district : districtName || '');
      } else {
        setPharmacies([]);
        const msg = data.error || data.hint || (res.status === 503 ? 'Nöbetçi eczane servisi yapılandırılmamış. Backend .env dosyasına ECZANE_API_KEY ekleyin (eczaneapi.com ücretsiz kayıt).' : 'Nöbetçi eczane listesi alınamadı.');
        setError(msg);
      }
    } catch (e) {
      setPharmacies([]);
      setError('Sunucuya bağlanılamadı. Backend çalışıyor mu? (Fiziksel cihazda test ediyorsanız: mobile/src/config/api.js içinde PHYSICAL_DEVICE_IP\'e bilgisayar IP\'nizi yazın.)');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadByLocation = useCallback(async () => {
    setLocationStatus('loading');
    setError(null);
    const loc = await getLocationWithCityDistrict();
    if (!loc) {
      setLocationStatus('error');
      setCity(DEFAULT_CITY);
      setDistrict('');
      setError('Konum alınamadı. Aşağıdan ilçe seçerek listele.');
      setPharmacies([]);
      return;
    }
    setLocationStatus('ok');
    const cityName = loc.city || DEFAULT_CITY;
    const districtName = loc.district || '';
    setCity(cityName);
    setDistrict(districtName);
    await fetchPharmacies(cityName, districtName);
  }, [fetchPharmacies]);

  const loadByDistrict = useCallback(() => {
    fetchPharmacies(city, district);
  }, [city, district, fetchPharmacies]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    if (city) await fetchPharmacies(city, district);
    else await loadByLocation();
    setRefreshing(false);
  }, [city, district, fetchPharmacies, loadByLocation]);

  useEffect(() => {
    if (!districtDefaultReady) return;
    const userDistrict = String(appUser?.address?.district || '').trim();
    if (userDistrict) {
      setCity(DEFAULT_CITY);
      fetchPharmacies(DEFAULT_CITY, userDistrict);
      return;
    }
    loadByLocation();
  }, [districtDefaultReady]);

  const openMaps = (item) => {
    const lat = item.location?.latitude;
    const lon = item.location?.longitude;
    if (lat != null && lon != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      Linking.openURL(url).catch(() => Alert.alert('Hata', 'Harita açılamadı'));
    }
  };

  const callPhone = (phone) => {
    if (!phone) return;
    const tel = String(phone).replace(/\s/g, '');
    Linking.openURL(`tel:${tel}`).catch(() => Alert.alert('Hata', 'Arama başlatılamadı'));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nöbetçi Eczaneler</Text>
        <Text style={styles.subtitle}>
          {[city, district].filter(Boolean).join(', ') || 'İlçe seçerek listele'}
        </Text>
      </View>

      {locationStatus === 'loading' && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#34C759" />
          <Text style={styles.loadingText}>Konum alınıyor...</Text>
        </View>
      )}

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>İlçe (Muğla)</Text>
        <TouchableOpacity style={styles.selectTouch} onPress={() => setDistrictModal(true)}>
          <Text style={[styles.selectText, !district && styles.selectPlaceholder]}>
            {district || 'Tüm ilçeler'}
          </Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.listBtn}
          onPress={loadByDistrict}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.listBtnText}>Nöbetçi eczaneleri getir</Text>
          )}
        </TouchableOpacity>
      </View>

      {locationStatus === 'error' && (
        <TouchableOpacity style={styles.retryLocationBtn} onPress={loadByLocation}>
          <Text style={styles.retryLocationText}>Konumu tekrar dene</Text>
        </TouchableOpacity>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={pharmacies}
        keyExtractor={(item) => item.id || String(Math.random())}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />
        }
        ListEmptyComponent={
          !loading && !refreshing ? (
            <Text style={styles.emptyText}>
              {error ? '' : 'İlçe seçip "Nöbetçi eczaneleri getir"e basın.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {item.address ? (
              <TouchableOpacity onPress={() => openMaps(item)}>
                <Text style={styles.address}>📍 {item.address}</Text>
              </TouchableOpacity>
            ) : null}
            {item.phone ? (
              <TouchableOpacity onPress={() => callPhone(item.phone)}>
                <Text style={styles.phone}>📞 {item.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {item.phone2 ? (
              <TouchableOpacity onPress={() => callPhone(item.phone2)}>
                <Text style={styles.phone}>📞 {item.phone2}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />

      <Modal visible={districtModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDistrictModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>İlçe seçin</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setDistrict(''); setDistrictModal(false); }}>
              <Text style={styles.modalItemText}>Tüm ilçeler</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {districtsList.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.modalItem}
                  onPress={() => { setDistrict(d.name); setDistrictModal(false); }}
                >
                  <Text style={styles.modalItemText}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDistrictModal(false)}>
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
  header: {
    backgroundColor: '#34C759',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: { position: 'absolute', top: 52, left: 16, padding: 8, zIndex: 1 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  filterSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  selectText: { fontSize: 15, color: '#333' },
  selectPlaceholder: { color: '#888' },
  selectArrow: { fontSize: 12, color: '#666' },
  listBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  listBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  retryLocationBtn: { marginHorizontal: 20, marginTop: 8, padding: 10, alignItems: 'center' },
  retryLocationText: { color: '#34C759', fontSize: 14, fontWeight: '600' },
  errorBox: { margin: 16, padding: 16, backgroundColor: '#fff0f0', borderRadius: 12, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 14, color: '#c00' },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 24, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  name: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8 },
  address: { fontSize: 14, color: '#555', marginBottom: 4 },
  phone: { fontSize: 14, color: '#34C759', fontWeight: '600', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalScroll: { maxHeight: 320 },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
});
