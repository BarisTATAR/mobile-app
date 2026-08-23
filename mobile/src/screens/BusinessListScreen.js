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
  TextInput,
  Alert,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { apiUrl } from '../config/api';
import { useUserDefaultDistrict } from '../hooks/useUserDefaultDistrict';
import { digitsOnly } from '../utils/phoneInput';
import { buildListAddressQueryParams } from '../utils/listAddressQueryParams';
import {
  getReservationSlotsForDate,
  isDateManuallyClosed,
  formatOpeningHoursHint,
} from '../utils/reservationSlots';
import ListingHoursMenu from '../components/ListingHoursMenu';
import ListingCardMedia from '../components/ListingCardMedia';
import ListingMediaGalleryModal from '../components/ListingMediaGalleryModal';
import ViewModeToggle from '../components/ViewModeToggle';
import ListMapView from '../components/ListMapView';
import {
  pinAppearanceForBusiness,
  businessActivityLabel,
  businessActivityMeta,
  BUSINESS_ACTIVITIES,
  BUSINESS_ACTIVITY_FILTER_OPTIONS,
} from '../utils/mapMarkerColors';

import {
  getProvinces,
  getDistrictsForProvince,
  getNeighborhoods,
  DEFAULT_CITY,
} from '../services/turkeyAddressService';

// API yanıt vermezse ilçe seçimi için yedek (Muğla)
const MUGLA_DISTRICTS_FALLBACK = ['Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris', 'Menteşe', 'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan'];

function getDateOptions() {
  const arr = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    arr.push({ key: `${y}-${m}-${day}`, label: i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : `${day}.${m}` });
  }
  return arr;
}

const DATE_OPTIONS = getDateOptions();

export default function BusinessListScreen({ navigation }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [neighborhoodsList, setNeighborhoodsList] = useState([]);
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [activityField, setActivityField] = useState('');
  const [hasChargingStation, setHasChargingStation] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);
  const [neighborhoodModal, setNeighborhoodModal] = useState(false);
  // Rezervasyon talebi
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [reservationModalVisible, setReservationModalVisible] = useState(false);
  const [count0to6, setCount0to6] = useState('0');
  const [count6to12, setCount6to12] = useState('0');
  const [count12Plus, setCount12Plus] = useState('0');
  const [reservationDate, setReservationDate] = useState(DATE_OPTIONS[0]?.key || '');
  const [reservationSlot, setReservationSlot] = useState('');
  const [reservationSending, setReservationSending] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const { appUser } = useUserDefaultDistrict(setDistrict);

  const businessMapLegend = React.useMemo(
    () => BUSINESS_ACTIVITIES.map((a) => ({
      color: a.color,
      shape: a.shape,
      icon: a.icon,
      label: a.label,
    })),
    []
  );

  const openGallery = useCallback((items, index = 0) => {
    if (!items?.length) return;
    setGalleryItems(items);
    setGalleryIndex(index);
    setGalleryVisible(true);
  }, []);

  const mapDefaultDistrict = district || appUser?.address?.district || '';

  const availableReservationSlots = React.useMemo(
    () => getReservationSlotsForDate(selectedBusiness, reservationDate),
    [selectedBusiness, reservationDate]
  );

  const reservationHoursHint = React.useMemo(
    () => (selectedBusiness ? formatOpeningHoursHint(selectedBusiness, reservationDate) : ''),
    [selectedBusiness, reservationDate]
  );

  useEffect(() => {
    let cancelled = false;
    getProvinces().then((list) => {
      if (!cancelled) setProvinces(list);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = getDistrictsForProvince(provinces, DEFAULT_CITY);
      if (cancelled) return;
      if (list && list.length > 0) setDistrictsList(list);
      else setDistrictsList(MUGLA_DISTRICTS_FALLBACK.map((name) => ({ id: name, name })));
    })();
    return () => { cancelled = true; };
  }, [provinces]);

  useEffect(() => {
    if (!district) {
      setNeighborhoodsList([]);
      setNeighborhood('');
      return;
    }
    let cancelled = false;
    (async () => {
      const list = await getNeighborhoods(DEFAULT_CITY, district);
      if (cancelled) return;
      const arr = Array.isArray(list) ? list : [];
      setNeighborhoodsList(arr);
      const names = arr.map((n) => (typeof n === 'object' && n != null ? n.name : n)).filter(Boolean);
      setNeighborhood((prev) => {
        const p = (prev || '').trim();
        if (!p) return '';
        return names.includes(p) ? prev : '';
      });
    })();
    return () => { cancelled = true; };
  }, [district]);

  const loadList = useCallback(async (filters) => {
    setLoading(true);
    try {
      const params = buildListAddressQueryParams(filters.district, filters.neighborhood, {
        forMap: !!filters.forMap,
      });
      if (filters.activityField) params.set('activityField', String(filters.activityField).trim());
      if (filters.hasChargingStation) params.set('hasChargingStation', 'true');
      const qs = params.toString();
      const url = apiUrl('/api/businesses' + (qs ? '?' + qs : ''));
      const res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (res.ok) {
        setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
      } else {
        setBusinesses([]);
      }
    } catch (e) {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const listFilters = useCallback(() => ({
    district: district || '',
    neighborhood: neighborhood || '',
    activityField: activityField || '',
    hasChargingStation: !!hasChargingStation,
    forMap: viewMode === 'map',
  }), [district, neighborhood, activityField, hasChargingStation, viewMode]);

  const applyFilter = useCallback(() => {
    loadList(listFilters());
  }, [loadList, listFilters]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadList(listFilters());
    setRefreshing(false);
  }, [loadList, listFilters]);

  useEffect(() => {
    loadList(listFilters());
  }, [loadList, listFilters]);

  const openReservationModal = (item) => {
    const defaultDate = DATE_OPTIONS[0]?.key || '';
    const initialSlots = getReservationSlotsForDate(item, defaultDate);
    setSelectedBusiness(item);
    setCount0to6('0');
    setCount6to12('0');
    setCount12Plus('0');
    setReservationDate(defaultDate);
    setReservationSlot(initialSlots[0] || '');
    setReservationModalVisible(true);
  };

  useEffect(() => {
    if (!reservationModalVisible || !selectedBusiness) return;
    if (availableReservationSlots.length === 0) {
      setReservationSlot('');
      return;
    }
    if (!availableReservationSlots.includes(reservationSlot)) {
      setReservationSlot(availableReservationSlots[0]);
    }
  }, [reservationModalVisible, selectedBusiness, reservationSlot, availableReservationSlots]);

  const sendReservationRequest = async () => {
    if (!selectedBusiness) return;
    const c0 = parseInt(count0to6, 10) || 0;
    const c1 = parseInt(count6to12, 10) || 0;
    const c2 = parseInt(count12Plus, 10) || 0;
    if (c0 + c1 + c2 === 0) {
      Alert.alert('Uyarı', 'En az bir kişi sayısı girin (0-6, 6-12 veya 12+ yaş).');
      return;
    }
    if (!reservationSlot) {
      Alert.alert('Uyarı', 'Seçtiğiniz tarih için işletme kapalı veya uygun saat bulunamadı.');
      return;
    }
    if (!appUser) {
      const name = (guestName || '').trim();
      const phone = (guestPhone || '').trim();
      if (!name) {
        Alert.alert('Uyarı', 'İsim soyisim girin.');
        return;
      }
      if (!phone) {
        Alert.alert('Uyarı', 'Cep telefonu girin.');
        return;
      }
    }
    setReservationSending(true);
    try {
      const body = {
        businessId: selectedBusiness._id,
        date: reservationDate,
        slot: reservationSlot,
        countAge0to6: c0,
        countAge6to12: c1,
        countAge12Plus: c2,
      };
      if (appUser) {
        body.userId = appUser.id;
      } else {
        body.guestName = (guestName || '').trim();
        body.guestPhone = (guestPhone || '').trim();
      }
      const res = await fetch(apiUrl('/api/reservations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setReservationModalVisible(false);
        setSelectedBusiness(null);
        Alert.alert('Başarılı', 'Rezervasyon talebiniz işletmeye iletildi. Onay bekleniyor.');
      } else {
        Alert.alert('Hata', data.error || 'Talep gönderilemedi.');
      }
    } catch (e) {
      Alert.alert('Hata', 'Bağlantı kurulamadı.');
    } finally {
      setReservationSending(false);
    }
  };

  const renderItem = ({ item }) => {
    const address = item.address;
    const addrStr = [address?.city, address?.district, address?.neighborhood].filter(Boolean).join(', ') || '—';
    const activityMeta = businessActivityMeta(item.activityField);
    const activity = activityMeta?.label || item.activityField || '';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openReservationModal(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardTextBlock}>
            <Text style={styles.businessName}>{item.businessName}</Text>
            {activity ? (
              <Text style={styles.activity}>
                {activityMeta?.icon ? `${activityMeta.icon} ` : ''}{activity}
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
            <Text style={styles.address}>{addrStr}</Text>
            <ListingHoursMenu item={item} />
            {item.hasChargingStation ? <Text style={styles.charging}>🔌 Elektrikli araç şarjı</Text> : null}
            {item.website ? (
              <Text style={styles.link} numberOfLines={1}>{item.website}</Text>
            ) : null}
          </View>
          <ListingCardMedia
            item={item}
            onOpenGallery={openGallery}
            imageWrapStyle={styles.cardImageWrap}
            thumbStyle={styles.cardThumb}
          />
        </View>
        <Text style={styles.rezervasyonHint}>Rezervasyon için dokunun</Text>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.listHeaderRoot}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rezervasyon</Text>
        <Text style={styles.subtitle}>
          İlçe ve mahalleyle süzün; kartlara dokunarak tarih/saat seçip talep gönderin. Listeyi kaydırarak filtre alanını yukarı alabilirsiniz.
        </Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filtre (yukarı kaydırılabilir)</Text>

        <Text style={styles.filterLabel}>İlçe</Text>
        <TouchableOpacity
          style={styles.selectTouch}
          onPress={() => setDistrictModal(true)}
        >
          <Text style={[styles.selectText, !district && styles.selectPlaceholder]}>
            {district || 'Tümü'}
          </Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.filterLabel}>Mahalle</Text>
        <TouchableOpacity
          style={styles.selectTouch}
          onPress={() => district && setNeighborhoodModal(true)}
          disabled={!district}
        >
          <Text style={[styles.selectText, !neighborhood && styles.selectPlaceholder]}>
            {neighborhood || 'Tümü'}
          </Text>
          <Text style={styles.selectArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.filterLabel}>Faaliyet türü</Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[styles.chip, activityField === '' && styles.chipActive]}
            onPress={() => setActivityField('')}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, activityField === '' && styles.chipTextActive]}>Hepsi</Text>
          </TouchableOpacity>
          {BUSINESS_ACTIVITY_FILTER_OPTIONS.map((a) => (
            <TouchableOpacity
              key={a.id || 'hepsi'}
              style={[styles.chip, activityField === a.id && styles.chipActive]}
              onPress={() => setActivityField(activityField === a.id ? '' : a.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, activityField === a.id && styles.chipTextActive]}>
                {a.icon ? `${a.icon} ` : ''}{a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setHasChargingStation(!hasChargingStation)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, hasChargingStation && styles.checkboxChecked]}>
            {hasChargingStation ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>Elektrikli araç şarjı</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterBtn} onPress={applyFilter} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.filterBtnText}>Filtrele / Listele</Text>
          )}
        </TouchableOpacity>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {viewMode === 'list' ? <Text style={styles.listSectionLabel}>İşletmeler</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {viewMode === 'map' ? (
        <>
          {listHeader}
          <View style={styles.mapWrap}>
            <ListMapView
              items={businesses}
              getItemId={(item) => item._id}
              getItemTitle={(item) => item.businessName}
              getItemPhone={(item) => item.phone}
              getPinAppearance={pinAppearanceForBusiness}
              getMarkerSubtitle={businessActivityLabel}
              legendItems={businessMapLegend}
              defaultDistrict={mapDefaultDistrict}
            />
          </View>
        </>
      ) : (
      <FlatList
        data={businesses}
        extraData={businesses.length}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          businesses.length === 0 && !loading ? styles.listContentGrow : null,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#34C759']} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {district || neighborhood || activityField || hasChargingStation
                ? 'Bu filtreye uygun işletme yok.'
                : 'Henüz kayıtlı işletme yok. Admin panelinden veya uygulama üzerinden işletme eklenebilir.'}
            </Text>
          ) : null
        }
      />
      )}

      <ListingMediaGalleryModal
        visible={galleryVisible}
        items={galleryItems}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />

      <Modal visible={reservationModalVisible} transparent animationType="fade">
        <View style={styles.reservationOverlay}>
          <View style={styles.reservationModalBox}>
            <Text style={styles.modalTitle}>
              Rezervasyon talebi — {selectedBusiness?.businessName || ''}
            </Text>
            <ScrollView style={styles.reservationForm} keyboardShouldPersistTaps="handled">
              {appUser ? (
                <View style={styles.reservationUserBlock}>
                  <Text style={styles.reservationLabel}>Rezervasyon yapan</Text>
                  <Text style={styles.reservationUserText}>{[appUser.name, appUser.surname].filter(Boolean).join(' ')}</Text>
                  {appUser.phone ? <Text style={styles.reservationUserSub}>📞 {appUser.phone}</Text> : null}
                </View>
              ) : (
                <>
                  <Text style={styles.reservationLabel}>İsim soyisim</Text>
                  <TextInput
                    style={styles.reservationInput}
                    value={guestName}
                    onChangeText={setGuestName}
                    placeholder="Adınız ve soyadınız"
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.reservationLabel}>Cep telefonu</Text>
                  <TextInput
                    style={styles.reservationInput}
                    value={guestPhone}
                    onChangeText={(t) => setGuestPhone(digitsOnly(t))}
                    placeholder="Sadece rakam"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                  />
                </>
              )}
              <Text style={styles.reservationLabel}>0-6 yaş kişi sayısı</Text>
              <TextInput
                style={styles.reservationInput}
                value={count0to6}
                onChangeText={setCount0to6}
                keyboardType="number-pad"
                placeholder="0"
              />
              <Text style={styles.reservationLabel}>6-12 yaş kişi sayısı</Text>
              <TextInput
                style={styles.reservationInput}
                value={count6to12}
                onChangeText={setCount6to12}
                keyboardType="number-pad"
                placeholder="0"
              />
              <Text style={styles.reservationLabel}>12+ yaş kişi sayısı</Text>
              <TextInput
                style={styles.reservationInput}
                value={count12Plus}
                onChangeText={setCount12Plus}
                keyboardType="number-pad"
                placeholder="0"
              />
              <Text style={styles.reservationLabel}>Tarih</Text>
              <TouchableOpacity style={styles.selectTouch} onPress={() => setDatePickerOpen(!datePickerOpen)}>
                <Text style={styles.selectText}>{reservationDate ? (DATE_OPTIONS.find((o) => o.key === reservationDate)?.label || reservationDate) : 'Tarih seçin'}</Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
              {datePickerOpen && (
                <ScrollView style={styles.slotScroll}>
                  {DATE_OPTIONS.map((o) => {
                    const closed = selectedBusiness && isDateManuallyClosed(selectedBusiness, o.key);
                    return (
                      <TouchableOpacity
                        key={o.key}
                        style={[styles.slotItem, closed && styles.slotItemDisabled]}
                        disabled={!!closed}
                        onPress={() => {
                          if (closed) return;
                          setReservationDate(o.key);
                          setDatePickerOpen(false);
                          setSlotPickerOpen(false);
                        }}
                      >
                        <Text style={[styles.slotItemText, closed && styles.slotItemTextDisabled]}>
                          {o.label} ({o.key}){closed ? ' — Kapalı' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {reservationHoursHint ? (
                <Text style={styles.hoursHint}>{reservationHoursHint}</Text>
              ) : null}
              {selectedBusiness?.activityField === 'tekne_turu' ? (
                <View style={styles.tekneTuruSlotBlock}>
                  <Text style={styles.reservationLabel}>Tur saati (işletme tarafından belirlenir)</Text>
                  <Text style={styles.tekneTuruSlotText}>
                    Liman çıkış: {selectedBusiness.limanCikisSaati || '09:00'} · Geliş: {selectedBusiness.limanGelisSaati || '18:00'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.reservationLabel}>Saat</Text>
                  <TouchableOpacity
                    style={styles.selectTouch}
                    onPress={() => availableReservationSlots.length > 0 && setSlotPickerOpen(!slotPickerOpen)}
                    disabled={availableReservationSlots.length === 0}
                  >
                    <Text style={styles.selectText}>
                      {reservationSlot || (availableReservationSlots.length === 0 ? 'Bu gün kapalı' : 'Saat seçin')}
                    </Text>
                    <Text style={styles.selectArrow}>▼</Text>
                  </TouchableOpacity>
                  {availableReservationSlots.length === 0 ? (
                    <Text style={styles.closedHint}>
                      {selectedBusiness && isDateManuallyClosed(selectedBusiness, reservationDate)
                        ? 'İşletme bu günü rezervasyona kapatmış.'
                        : 'İşletme bu tarihte kapalı veya uygun saat yok.'}
                    </Text>
                  ) : null}
                  {slotPickerOpen && availableReservationSlots.length > 0 && (
                    <ScrollView style={styles.slotScroll}>
                      {availableReservationSlots.map((s) => (
                        <TouchableOpacity key={s} style={styles.slotItem} onPress={() => { setReservationSlot(s); setSlotPickerOpen(false); }}>
                          <Text style={styles.slotItemText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.reservationActions}>
              <TouchableOpacity style={styles.reservationCancelBtn} onPress={() => { setReservationModalVisible(false); setSelectedBusiness(null); }}>
                <Text style={styles.reservationCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reservationSubmitBtn} onPress={sendReservationRequest} disabled={reservationSending}>
                {reservationSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.reservationSubmitText}>Talep gönder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={districtModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDistrictModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>İlçe seçin</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setDistrict(''); setNeighborhood(''); setDistrictModal(false); }}>
              <Text style={styles.modalItemText}>Tümü</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {districtsList.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.modalItem}
                  onPress={() => { setDistrict(d.name); setNeighborhood(''); setDistrictModal(false); }}
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

      <Modal visible={neighborhoodModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNeighborhoodModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mahalle seçin</Text>
            <TouchableOpacity style={styles.modalItem} onPress={() => { setNeighborhood(''); setNeighborhoodModal(false); }}>
              <Text style={styles.modalItemText}>Tümü</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalScroll}>
              {neighborhoodsList.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={styles.modalItem}
                  onPress={() => { setNeighborhood(n.name); setNeighborhoodModal(false); }}
                >
                  <Text style={styles.modalItemText}>{n.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setNeighborhoodModal(false)}>
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
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
  chipScroll: { marginTop: 2, marginBottom: 2 },
  chipScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#34C759', backgroundColor: '#34C759' },
  checkboxTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 14, color: '#333', flex: 1 },
  filterBtn: {
    marginTop: 12,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
  mapWrap: { flex: 1, minHeight: 360, marginHorizontal: 16, marginBottom: 16 },
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardImageWrap: {
    alignItems: 'center',
  },
  cardThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  cardImageHint: {
    fontSize: 10,
    color: '#34C759',
    marginTop: 4,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: '100%',
    flex: 1,
    maxHeight: Dimensions.get('window').height - 120,
  },
  imageModalCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#34C759',
    borderRadius: 10,
  },
  imageModalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  businessName: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  activity: { fontSize: 14, color: '#34C759', fontWeight: '600', marginBottom: 6 },
  phone: { fontSize: 14, color: '#555', marginBottom: 2 },
  phoneTouch: { alignSelf: 'flex-start', marginBottom: 2 },
  address: { fontSize: 13, color: '#666', marginBottom: 2 },
  charging: { fontSize: 12, color: '#666', marginTop: 4 },
  link: { fontSize: 12, color: '#34C759', marginTop: 4 },
  rezervasyonHint: { fontSize: 12, color: '#34C759', marginTop: 8, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalScroll: { maxHeight: 320 },
  modalItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#34C759' },
  reservationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  reservationModalBox: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '85%' },
  reservationForm: { padding: 20, maxHeight: 380 },
  reservationLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  reservationUserBlock: { marginBottom: 8 },
  reservationUserText: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 4 },
  reservationUserSub: { fontSize: 14, color: '#666', marginTop: 2 },
  reservationInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 16 },
  reservationActions: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  reservationCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center' },
  reservationCancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
  reservationSubmitBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  reservationSubmitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  slotScroll: { maxHeight: 160, marginTop: 4 },
  slotItem: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  slotItemText: { fontSize: 15, color: '#333' },
  slotItemDisabled: { backgroundColor: '#f5f5f5', opacity: 0.7 },
  slotItemTextDisabled: { color: '#999' },
  hoursHint: { fontSize: 12, color: '#666', marginTop: 8, lineHeight: 17 },
  closedHint: { fontSize: 12, color: '#dc3545', marginTop: 6 },
  tekneTuruSlotBlock: { marginTop: 12, marginBottom: 4 },
  tekneTuruSlotText: { fontSize: 16, color: '#333', fontWeight: '600', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#f0f8ff', borderRadius: 10 },
});
