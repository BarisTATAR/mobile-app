import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiUrl } from '../config/api';
import { useLanguage } from '../i18n/LanguageContext';


const EXPIRING_DAYS = 30;

const TYPES = [
  { key: 'isletme', label: 'İşletmeler' },
  { key: 'esnaf', label: 'Esnaflar' },
  { key: 'kampanyalar', label: 'Kampanyalar/İndirimler' },
  { key: 'duyurular', label: 'Duyurular' },
  { key: 'isilanlari', label: 'İş ilanları' },
  { key: 'cekici', label: 'Çekici' },
  { key: 'lastikci', label: 'Lastikçi' },
  { key: 'taksi', label: 'Taksi' },
];

const ACTIVITY_LABEL = {
  restorant: 'Restoran',
  cafe_bar: 'Cafe / Bar',
  tekne_turu: 'Tekne turu',
  plaj_beach: 'Plaj / Beach',
};

function activityFieldLabel(field) {
  const f = String(field || '').trim();
  return ACTIVITY_LABEL[f] || f || 'Diğer';
}

function parseDateStr(str) {
  if (!str || typeof str !== 'string') return new Date();
  const trimmed = str.trim();
  if (!trimmed) return new Date();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
}

function formatDateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateNotBeforeToday(date) {
  const t = startOfToday();
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  return x < t ? new Date(t) : date;
}

function errorIfLicenseExpiryBeforeTodayStr(s) {
  const t = (s != null ? String(s).trim() : '');
  if (!t) return 'Tarih seçin.';
  const part = t.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return 'Geçersiz tarih.';
  const today = startOfToday();
  const [y, mo, da] = part.split('-').map((n) => parseInt(n, 10));
  const chosen = new Date(y, mo - 1, da);
  chosen.setHours(0, 0, 0, 0);
  if (chosen < today) return 'Lisans veya kampanya bitiş tarihi bugünden önce olamaz.';
  return null;
}

function expiryLabelForAdminType(typeKey) {
  return typeKey === 'kampanyalar' ? 'Kampanya bitiş tarihi' : 'Lisans bitiş';
}

function getItemTitle(type, item) {
  if (!item) return '';
  switch (type) {
    case 'isletme': return item.businessName || item._id;
    case 'esnaf': return item.name || item._id;
    case 'kampanyalar': return item.title || item._id;
    case 'duyurular': return item.title || item._id;
    case 'isilanlari': return item.title || item._id;
    case 'cekici': return item.companyName || item._id;
    case 'lastikci': return item.name || item._id;
    case 'taksi': return item.companyName || item._id;
    default: return item._id;
  }
}

/** İşletme: faaliyet alanı; esnaf: kategori; diğerleri: tek grup */
function groupBySubcategory(typeKey, items) {
  if (!items?.length) return [];
  if (typeKey === 'isletme') {
    const map = {};
    for (const item of items) {
      const k = String(item.activityField || '').trim() || '_diger';
      if (!map[k]) map[k] = [];
      map[k].push(item);
    }
    const order = ['restorant', 'cafe_bar', 'tekne_turu', 'plaj_beach', '_diger'];
    const keys = [...new Set([...order.filter((k) => map[k]), ...Object.keys(map)])];
    return keys.map((k) => ({
      subLabel: k === '_diger' ? 'Diğer' : activityFieldLabel(k),
      items: map[k],
    }));
  }
  if (typeKey === 'esnaf') {
    const map = {};
    for (const item of items) {
      const k = (item.category && String(item.category).trim()) || 'Kategori yok';
      if (!map[k]) map[k] = [];
      map[k].push(item);
    }
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b, 'tr'));
    return keys.map((k) => ({ subLabel: k, items: map[k] }));
  }
  return [{ subLabel: null, items }];
}

export default function LisansBitmekUzereScreen() {
  const { tx } = useLanguage();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // { typeKey, item }
  const [pickerDate, setPickerDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const result = {};
    let hasError = null;
    for (const { key } of TYPES) {
      try {
        const res = await fetch(apiUrl(`/api/admin/${key}?expiringSoon=${EXPIRING_DAYS}`));
        const json = await res.json().catch(() => ({}));
        result[key] = Array.isArray(json.list) ? json.list : [];
        if (!res.ok) hasError = json.error || json.message || `Hata ${res.status}`;
      } catch (e) {
        result[key] = [];
        hasError = 'Sunucuya bağlanılamadı';
      }
    }
    setData(result);
    setError(hasError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAll().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const openEdit = useCallback((typeKey, item) => {
    setPickerDate(dateNotBeforeToday(parseDateStr(item.licenseExpiry)));
    setEditTarget({ typeKey, item });
  }, []);

  const closeEdit = useCallback(() => {
    setEditTarget(null);
  }, []);

  const saveLicenseExpiry = useCallback(async () => {
    if (!editTarget) return;
    const { typeKey, item } = editTarget;
    const licenseExpiry = formatDateToStr(dateNotBeforeToday(pickerDate));
    const dateErr = errorIfLicenseExpiryBeforeTodayStr(licenseExpiry);
    if (dateErr) {
      Alert.alert(tx('Tarih'), dateErr);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/${typeKey}/${item._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseExpiry }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert(tx('Hata'), json.error || json.message || 'Güncellenemedi');
        return;
      }
      await fetchAll();
      const kampanya = typeKey === 'kampanyalar';
      Alert.alert(tx('Tamam'), kampanya ? 'Kampanya bitiş tarihi güncellendi.' : 'Lisans bitiş tarihi güncellendi.');
      closeEdit();
    } catch (e) {
      Alert.alert(tx('Hata'), 'Bağlantı hatası.');
    } finally {
      setSaving(false);
    }
  }, [editTarget, pickerDate, closeEdit, fetchAll]);

  const total = TYPES.reduce((acc, { key }) => acc + (data[key]?.length || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B4D4A" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4D4A']} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{tx('Lisansı bitmek üzere')}</Text>
          <Text style={styles.subtitle}>
            Önümüzdeki {EXPIRING_DAYS} gün içinde lisansı biten kayıtlar ({total} adet). Kayıtlar türe ve alt kategoriye göre gruplanır. Bir kayda dokunarak lisans bitiş tarihini güncelleyebilirsiniz.
          </Text>
        </View>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {TYPES.map(({ key, label }) => {
          const items = data[key] || [];
          if (items.length === 0) return null;
          const groups = groupBySubcategory(key, items);
          return (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>{label} ({items.length})</Text>
              {groups.map((g) => (
                <View key={g.subLabel || '_all'} style={styles.subSection}>
                  {g.subLabel ? (
                    <Text style={styles.subSectionTitle}>{g.subLabel} ({g.items.length})</Text>
                  ) : null}
                  {g.items.map((item) => (
                    <TouchableOpacity
                      key={item._id}
                      style={styles.card}
                      onPress={() => openEdit(key, item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardHint}>
                        {key === 'kampanyalar' ? 'Dokun: kampanya bitiş tarihini güncelle' : 'Dokun: lisans tarihini güncelle'}
                      </Text>
                      <Text style={styles.cardTitle}>{getItemTitle(key, item)}</Text>
                      {item.phone ? <Text style={styles.cardSub}>{item.phone}</Text> : null}
                      <Text style={styles.cardDate}>
                        {expiryLabelForAdminType(key)}: {item.licenseExpiry || '-'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          );
        })}
        {total === 0 && !error ? (
          <Text style={styles.emptyText}>Lisansı bitmek üzere kayıt bulunamadı.</Text>
        ) : null}
      </ScrollView>

      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={closeEdit}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editTarget?.typeKey === 'kampanyalar' ? 'Kampanya bitiş tarihi' : 'Lisans bitiş tarihi'}
            </Text>
            {editTarget ? (
              <Text style={styles.modalSub} numberOfLines={2}>
                {getItemTitle(editTarget.typeKey, editTarget.item)}
              </Text>
            ) : null}
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={startOfToday()}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  if (event.type === 'dismissed') return;
                  if (selectedDate) setPickerDate(dateNotBeforeToday(selectedDate));
                } else if (selectedDate) {
                  setPickerDate(dateNotBeforeToday(selectedDate));
                }
              }}
              locale="tr-TR"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeEdit} disabled={saving}>
                <Text style={styles.cancelBtnText}>{tx('İptal')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={saveLicenseExpiry}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EB' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F1EB',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F1EB',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4D4A',
    marginBottom: 8,
  },
  subSection: {
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 6,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#1B4D4A',
  },
  cardHint: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  cardSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  cardDate: {
    fontSize: 13,
    color: '#e65100',
    marginTop: 4,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#1B4D4A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
