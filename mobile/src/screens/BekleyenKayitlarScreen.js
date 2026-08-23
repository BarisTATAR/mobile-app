import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { apiUrl } from '../config/api';

export default function BekleyenKayitlarScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/pending-businesses'), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setList(Array.isArray(data.list) ? data.list : []);
      else setError(data.error || 'Liste alınamadı');
    } catch (e) {
      setList([]);
      setError('Sunucuya bağlanılamadı');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchList().then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  }, [fetchList]);

  const handleApprove = useCallback(async (item) => {
    Alert.alert('Onayla', `"${item.businessName}" onaylansın mı? İşletme girişi yapıp kullanıcıda listelenecek.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Onayla',
        onPress: async () => {
          setActionId(item._id);
          try {
            const res = await fetch(apiUrl(`/api/admin/approve-business/${item._id}`), { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              Alert.alert('Onaylandı', 'İşletme onaylandı. Giriş yapabilir ve kullanıcıda listelenecek.');
              await fetchList();
            } else Alert.alert('Hata', data.error || 'Onaylama başarısız');
          } catch (e) {
            Alert.alert('Hata', 'Bağlantı hatası');
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  }, [fetchList]);

  const handleReject = useCallback((item) => {
    Alert.alert('Reddet', `"${item.businessName}" kaydı reddedilsin mi? Kayıt silinecek.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: async () => {
          setActionId(item._id);
          try {
            const res = await fetch(apiUrl(`/api/admin/reject-business/${item._id}`), { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              Alert.alert('Reddedildi', 'Kayıt reddedildi.');
              await fetchList();
            } else Alert.alert('Hata', data.error || 'Reddetme başarısız');
          } catch (e) {
            Alert.alert('Hata', 'Bağlantı hatası');
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  }, [fetchList]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#34C759']} />
      }
    >
      <Text style={styles.subtitle}>Uygulama üzerinden (İşletme kayıt ol) ile kayıt olan işletmeler. Onaylayınca giriş yapıp kullanıcıda listelenir.</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {list.length === 0 && !error ? (
        <Text style={styles.emptyText}>Bekleyen kayıt yok.</Text>
      ) : (
        list.map((item) => (
          <View key={item._id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.businessName}</Text>
            {item.phone ? <Text style={styles.cardRow}>📞 {item.phone}</Text> : null}
            {item.activityField ? <Text style={styles.cardRow}>Faaliyet: {item.activityField}</Text> : null}
            {item.address ? (
              <Text style={styles.cardRow}>
                {[item.address.city, item.address.district, item.address.neighborhood].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {item.licenseExpiry ? <Text style={styles.cardRow}>Lisans bitiş: {item.licenseExpiry}</Text> : null}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.approveBtn, actionId === item._id && styles.btnDisabled]}
                onPress={() => handleApprove(item)}
                disabled={!!actionId}
              >
                {actionId === item._id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.approveBtnText}>Onayla</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, actionId === item._id && styles.btnDisabled]}
                onPress={() => handleReject(item)}
                disabled={!!actionId}
              >
                <Text style={styles.rejectBtnText}>Reddet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 16 },
  errorText: { fontSize: 14, color: '#c00', marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8 },
  cardRow: { fontSize: 14, color: '#555', marginBottom: 4 },
  cardActions: { flexDirection: 'row', marginTop: 12 },
  approveBtn: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#c00',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#c00', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
