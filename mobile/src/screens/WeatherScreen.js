import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getCurrentPosition, reverseGeocode } from '../services/locationService';
import { useLanguage } from '../i18n/LanguageContext';


const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

function formatTime(iso, locale) {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso, locale) {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function WeatherScreen({ navigation }) {
  const { tx, t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const weatherLabel = (code) => {
    const key = `weather.codes.${code}`;
    const label = t(key);
    return label === key ? t('weather.unknownCode', { code }) : label;
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [daily, setDaily] = useState(null);
  const [locationLabel, setLocationLabel] = useState(''); // İlçe, Mahalle

  const fetchWeather = useCallback(async (latitude, longitude) => {
    setError(null);
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
        hourly: 'temperature_2m,weather_code',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code',
        timezone: 'auto',
        forecast_days: 7,
      });
      const res = await fetch(`${OPEN_METEO}?${params.toString()}`);
      const data = await res.json();
      if (data.current) {
        setCurrent(data.current);
        setHourly(data.hourly || null);
        setDaily(data.daily || null);
      } else {
        setError('weather.unavailable');
      }
    } catch (e) {
      setError('Sunucuya bağlanılamadı.');
      setCurrent(null);
      setHourly(null);
      setDaily(null);
    }
  }, []);

  const loadByLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    const coords = await getCurrentPosition();
    if (!coords) {
      setError('weather.noLocation');
      setLoading(false);
      return;
    }
    const geo = await reverseGeocode(coords);
    const parts = [];
    if (geo && geo.district) parts.push(geo.district);
    if (geo && geo.neighbourhood) parts.push(geo.neighbourhood);
    setLocationLabel(parts.length > 0 ? parts.join(', ') : `${coords.latitude.toFixed(2)}°, ${coords.longitude.toFixed(2)}°`);

    await fetchWeather(coords.latitude, coords.longitude);
    setLoading(false);
  }, [fetchWeather]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const coords = await getCurrentPosition();
    if (coords) {
      const geo = await reverseGeocode(coords);
      const parts = [];
      if (geo && geo.district) parts.push(geo.district);
      if (geo && geo.neighbourhood) parts.push(geo.neighbourhood);
      setLocationLabel(parts.length > 0 ? parts.join(', ') : '');
      await fetchWeather(coords.latitude, coords.longitude);
    }
    setRefreshing(false);
  }, [fetchWeather]);

  React.useEffect(() => {
    loadByLocation();
  }, []);

  if (loading && !current) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← {tx('Geri')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{tx('Hava Durumu')}</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1B4D4A" />
          <Text style={styles.loadingText}>{tx('Konum ve hava durumu alınıyor...')}</Text>
        </View>
      </View>
    );
  }

  const hourlyList = hourly && hourly.time && hourly.time.length
    ? hourly.time.slice(0, 24).map((t, i) => ({
        time: t,
        temp: hourly.temperature_2m[i],
        code: hourly.weather_code[i],
      }))
    : [];
  const dailyList = daily && daily.time && daily.time.length
    ? daily.time.map((t, i) => ({
        date: t,
        max: daily.temperature_2m_max[i],
        min: daily.temperature_2m_min[i],
        code: daily.weather_code[i],
      }))
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← {tx('Geri')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{tx('Hava Durumu')}</Text>
        {locationLabel ? (
          <Text style={styles.subtitle}>{t('weather.location', { place: locationLabel })}</Text>
        ) : (
          <Text style={styles.subtitle}>{tx('Konumunuza göre güncellenir')}</Text>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{tx(error)}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadByLocation}>
            <Text style={styles.retryBtnText}>{tx('Tekrar dene')}</Text>
          </TouchableOpacity>
        </View>
      ) : current ? (
        <>
          <View style={styles.card}>
            <Text style={styles.temp}>{Math.round(current.temperature_2m)}°</Text>
            <Text style={styles.desc}>{weatherLabel(current.weather_code)}</Text>
            <View style={styles.details}>
              {current.relative_humidity_2m != null && (
                <Text style={styles.detail}>{t('weather.humidity', { value: current.relative_humidity_2m })}</Text>
              )}
              {current.wind_speed_10m != null && (
                <Text style={styles.detail}>{t('weather.wind', { value: current.wind_speed_10m })}</Text>
              )}
            </View>
          </View>

          {hourlyList.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tx('Saatlik tahmin')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
                {hourlyList.map((h, i) => (
                  <View key={h.time} style={styles.hourlyItem}>
                    <Text style={styles.hourlyTime}>{formatTime(h.time, locale)}</Text>
                    <Text style={styles.hourlyTemp}>{Math.round(h.temp)}°</Text>
                    <Text style={styles.hourlyDesc} numberOfLines={1}>{weatherLabel(h.code)}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {dailyList.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tx('Günlük tahmin')}</Text>
              {dailyList.map((d, i) => (
                <View key={d.date} style={styles.dailyRow}>
                  <Text style={styles.dailyDate}>{formatDate(d.date, locale)}</Text>
                  <Text style={styles.dailyDesc} numberOfLines={1}>{weatherLabel(d.code)}</Text>
                  <Text style={styles.dailyTemp}>
                    {Math.round(d.min)}° / {Math.round(d.max)}°
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: '#1B4D4A',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: { position: 'absolute', top: 52, left: 16, padding: 8, zIndex: 1 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 200 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666' },
  errorBox: { margin: 20, padding: 16, backgroundColor: '#fff0f0', borderRadius: 12, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 14, color: '#c00', marginBottom: 12 },
  retryBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#1B4D4A', borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    margin: 20,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  temp: { fontSize: 56, fontWeight: 'bold', color: '#333' },
  desc: { fontSize: 18, color: '#666', marginTop: 8 },
  details: { marginTop: 16, alignItems: 'center' },
  detail: { fontSize: 14, color: '#555', marginTop: 4 },
  section: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e8e8e8' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12 },
  hourlyScroll: { marginHorizontal: -16 },
  hourlyItem: { width: 72, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginRight: 4 },
  hourlyTime: { fontSize: 12, color: '#666' },
  hourlyTemp: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 4 },
  hourlyDesc: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },
  dailyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  dailyDate: { width: 100, fontSize: 14, color: '#333', fontWeight: '500' },
  dailyDesc: { flex: 1, fontSize: 13, color: '#666', marginHorizontal: 8 },
  dailyTemp: { fontSize: 14, fontWeight: '600', color: '#1B4D4A' },
});
