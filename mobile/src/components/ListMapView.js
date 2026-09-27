import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  InteractionManager,
  Platform,
} from 'react-native';
import MapListingPin from './MapListingPin';
import { itemsWithMapCoordinates, googleMapsQueryForItem, districtMapRegion } from '../utils/mapCoordinates';

function loadMapLibraries() {
  const maps = require('react-native-maps');
  const Location = require('expo-location');
  return {
    MapView: maps.default,
    Marker: maps.Marker,
    PROVIDER_DEFAULT: maps.PROVIDER_DEFAULT,
    Location,
  };
}

const MUGLA_REGION = {
  latitude: 37.2153,
  longitude: 28.3636,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

const DISTRICT_REGION_DELTA = 0.14;

function defaultMapRegion(defaultDistrict) {
  const d = defaultDistrict != null ? String(defaultDistrict).trim() : '';
  if (d) return districtMapRegion(d, DISTRICT_REGION_DELTA);
  return MUGLA_REGION;
}

function regionForMarkers(markers, defaultDistrict) {
  const districtRegion = defaultMapRegion(defaultDistrict);
  const d = defaultDistrict != null ? String(defaultDistrict).trim() : '';
  if (d) return districtRegion;
  if (!markers.length) return districtRegion;

  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.06;
  const latDelta = Math.max(0.04, maxLat - minLat + pad);
  const lngDelta = Math.max(0.04, maxLng - minLng + pad);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.min(MUGLA_REGION.latitudeDelta, latDelta),
    longitudeDelta: Math.min(MUGLA_REGION.longitudeDelta, lngDelta),
  };
}

export default function ListMapView({
  items = [],
  getItemId,
  getItemTitle,
  getItemPhone,
  getPinColor,
  getPinAppearance,
  getMarkerSubtitle,
  legendItems = null,
  defaultDistrict = '',
  emptyHint = 'Haritada gösterilecek konumlu kayıt yok. İlçe/mahalle veya Google Haritalar linki girin.',
  noCoordsHint = 'Bu kayıtlar için konum bulunamadı. Admin panelinde ilçe/mahalle bilgisi girin.',
}) {
  const mapRef = useRef(null);
  const [mapLib, setMapLib] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [region, setRegion] = useState(() => defaultMapRegion(defaultDistrict));

  const initialRegion = useMemo(
    () => defaultMapRegion(defaultDistrict),
    [defaultDistrict],
  );

  const markers = useMemo(() => {
    return itemsWithMapCoordinates(items).map((entry) => {
      const appearance = getPinAppearance
        ? getPinAppearance(entry.item)
        : {
          shape: 'circle',
          color: getPinColor ? getPinColor(entry.item) : '#34C759',
          icon: null,
          label: getMarkerSubtitle ? getMarkerSubtitle(entry.item) : '',
        };
      return {
        ...entry,
        id: getItemId(entry.item),
        title: getItemTitle(entry.item) || 'Kayıt',
        phone: getItemPhone ? getItemPhone(entry.item) : '',
        subtitle: getMarkerSubtitle ? getMarkerSubtitle(entry.item) : appearance.label || '',
        pinColor: appearance.color,
        pinShape: appearance.shape || 'circle',
        pinIcon: appearance.icon || null,
        pinLabel: appearance.label || '',
      };
    });
  }, [items, getItemId, getItemTitle, getItemPhone, getPinColor, getPinAppearance, getMarkerSubtitle]);

  const resolvedLegend = useMemo(() => {
    if (Array.isArray(legendItems) && legendItems.length > 0) return legendItems;
    const seen = new Map();
    markers.forEach((m) => {
      const label = m.pinLabel || m.subtitle || 'Diğer';
      const key = `${m.pinShape}-${m.pinColor}-${label}`;
      if (!seen.has(key)) {
        seen.set(key, {
          color: m.pinColor,
          shape: m.pinShape,
          icon: m.pinIcon,
          label,
        });
      }
    });
    if (seen.size === 0 && !getPinAppearance && !getPinColor) {
      return [{ color: '#34C759', shape: 'circle', label: 'İşletme' }];
    }
    return Array.from(seen.values());
  }, [legendItems, getPinAppearance, getPinColor, markers]);

  const loadUserLocation = useCallback(async () => {
    const Location = mapLib?.Location;
    if (!Location) return;
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLocation(loc);
      setLocationStatus('ok');
    } catch {
      setLocationStatus('error');
    }
  }, [mapLib]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setMapLib(loadMapLibraries());
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (mapLib) loadUserLocation();
  }, [mapLib, loadUserLocation]);

  useEffect(() => {
    const next = regionForMarkers(markers, defaultDistrict);
    setRegion(next);
    mapRef.current?.animateToRegion(next, 350);
  }, [markers, defaultDistrict]);

  const zoomBy = (factor) => {
    setRegion((prev) => ({
      ...prev,
      latitudeDelta: Math.min(2, Math.max(0.01, prev.latitudeDelta * factor)),
      longitudeDelta: Math.min(2, Math.max(0.01, prev.longitudeDelta * factor)),
    }));
  };

  const focusUser = () => {
    if (!userLocation) {
      loadUserLocation();
      return;
    }
    mapRef.current?.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      400
    );
  };

  const onMarkerPress = (marker) => {
    const actions = [{ text: 'İptal', style: 'cancel' }];
    if (marker.phone) {
      actions.unshift({
        text: 'Ara',
        onPress: () => Linking.openURL(`tel:${String(marker.phone).replace(/\s/g, '')}`),
      });
    }
    actions.unshift({
      text: 'Google Haritalar',
      onPress: () => {
        const target = googleMapsQueryForItem(marker.item, marker);
        if (!target) {
          Alert.alert('Hata', 'Harita açılamadı');
          return;
        }
        const url = target.type === 'url'
          ? target.value
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.value)}`;
        Linking.openURL(url).catch(() => Alert.alert('Hata', 'Harita açılamadı'));
      },
    });
    const message = [marker.subtitle, marker.phone ? `📞 ${marker.phone}` : ''].filter(Boolean).join('\n');
    Alert.alert(marker.title, message || 'Konum', actions);
  };

  if (markers.length === 0 && items.length === 0 && locationStatus !== 'loading') {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyHint}</Text>
      </View>
    );
  }

  if (markers.length === 0 && items.length > 0 && locationStatus !== 'loading') {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{noCoordsHint}</Text>
      </View>
    );
  }

  if (!mapLib) {
    return (
      <View style={styles.wrap}>
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator color="#34C759" />
          <Text style={styles.mapPlaceholderText}>Harita hazırlanıyor…</Text>
        </View>
      </View>
    );
  }

  const { MapView, Marker, PROVIDER_DEFAULT } = mapLib;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={locationStatus === 'ok'}
        showsMyLocationButton={false}
        zoomEnabled
        zoomTapEnabled
        scrollEnabled
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.subtitle || (m.phone ? `📞 ${m.phone}` : undefined)}
            onPress={() => onMarkerPress(m)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MapListingPin color={m.pinColor} shape={m.pinShape} icon={m.pinIcon} size={24} />
          </Marker>
        ))}
      </MapView>

      <View style={styles.zoomCol}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(0.5)} activeOpacity={0.85}>
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(2)} activeOpacity={0.85}>
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomBtn, styles.locBtn]} onPress={focusUser} activeOpacity={0.85}>
          <Text style={styles.locBtnText}>◎</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          {markers.length} konum · Mavi nokta: siz
          {locationStatus === 'loading' ? ' · Konum alınıyor…' : ''}
        </Text>
        {resolvedLegend.length > 0 ? (
          <View style={styles.legendRow}>
            {resolvedLegend.map((leg) => (
              <View key={`${leg.shape}-${leg.color}-${leg.label}`} style={styles.legendItem}>
                <MapListingPin color={leg.color} shape={leg.shape || 'circle'} icon={leg.icon} size={12} />
                <Text style={styles.legendItemText}>{leg.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.legendHint}>Pine dokunun: ara veya Google Haritalar</Text>
      </View>

      {locationStatus === 'loading' ? (
        <View style={styles.locLoading}>
          <ActivityIndicator size="small" color="#34C759" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 240, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1, width: '100%' },
  mapPlaceholder: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f2',
  },
  mapPlaceholderText: { marginTop: 8, fontSize: 13, color: '#555' },
  zoomCol: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 8,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  zoomBtnText: { fontSize: 22, fontWeight: '700', color: '#333', marginTop: -2 },
  locBtn: { backgroundColor: '#e3f2fd' },
  locBtnText: { fontSize: 18, color: '#1565c0', fontWeight: '700' },
  legend: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    padding: 8,
  },
  legendText: { fontSize: 12, color: '#333', fontWeight: '600' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendItemText: { fontSize: 11, color: '#444' },
  legendHint: { fontSize: 11, color: '#666', marginTop: 4 },
  locLoading: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 6,
  },
  emptyWrap: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f0f9f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cfe8d4',
  },
  emptyText: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  emptySub: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },
});
