import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiUrl } from '../config/api';
import { DEFAULT_CITY } from '../services/turkeyAddressService';
import PremiumMenuEditor from './PremiumMenuEditor';
import { useLanguage } from '../i18n/LanguageContext';


function parseDateStr(str) {
  const s = String(str || '').trim();
  if (!s) return new Date();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateNotBeforeToday(date) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const c = new Date(date);
  c.setHours(0, 0, 0, 0);
  return c < t ? t : date;
}

function errorIfLicenseExpiryBeforeToday(licenseExpiryStr) {
  const s = String(licenseExpiryStr || '').trim();
  if (!s) return null;
  const d = parseDateStr(s);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d < t) return 'Bitiş tarihi bugünden önce olamaz.';
  return null;
}

function emptyKampanyaForm(displayName, district) {
  return {
    title: '',
    companyName: displayName || '',
    contactPhone: '',
    discountText: '',
    addressDistrict: district || '',
    addressNeighborhood: '',
    startDate: '',
    licenseExpiry: '',
    imageUrl: '',
  };
}

function emptyIsIlaniForm(displayName, district) {
  return {
    title: '',
    company: displayName || '',
    description: '',
    contactPhone: '',
    contactEmail: '',
    addressDistrict: district || '',
    addressNeighborhood: '',
    imageUrl: '',
  };
}

function resolveImageUri(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return apiUrl(s);
}

function buildAddressPayload(form, registeredDistrict) {
  const district = String(form.addressDistrict || registeredDistrict || '').trim();
  return {
    addressCity: DEFAULT_CITY,
    addressDistrict: district,
    addressNeighborhood: String(form.addressNeighborhood || '').trim(),
  };
}

export default function PremiumListingsPanel({
  ownerType,
  ownerId,
  loginKey,
  displayName = '',
  registeredDistrict = '',
}) {
  const { tx } = useLanguage();
  const [subTab, setSubTab] = useState('kampanya');
  const [kampanyalar, setKampanyalar] = useState([]);
  const [isIlanlari, setIsIlanlari] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [kampanyaForm, setKampanyaForm] = useState(() => emptyKampanyaForm(displayName, registeredDistrict));
  const [isIlaniForm, setIsIlaniForm] = useState(() => emptyIsIlaniForm(displayName, registeredDistrict));
  const [datePickerField, setDatePickerField] = useState(null);
  const [datePickerTemp, setDatePickerTemp] = useState(new Date());

  const authQuery = `loginKey=${encodeURIComponent(loginKey || '')}`;

  const fetchKampanyalar = useCallback(async () => {
    if (!ownerId || !loginKey) {
      setKampanyalar([]);
      return;
    }
    const res = await fetch(apiUrl(`/api/premium/${ownerType}/${ownerId}/kampanyalar?${authQuery}`));
    const data = await res.json().catch(() => ({}));
    setKampanyalar(res.ok && Array.isArray(data.list) ? data.list : []);
  }, [ownerType, ownerId, loginKey, authQuery]);

  const fetchIsIlanlari = useCallback(async () => {
    if (!ownerId || !loginKey) {
      setIsIlanlari([]);
      return;
    }
    const res = await fetch(apiUrl(`/api/premium/${ownerType}/${ownerId}/isilanlari?${authQuery}`));
    const data = await res.json().catch(() => ({}));
    setIsIlanlari(res.ok && Array.isArray(data.list) ? data.list : []);
  }, [ownerType, ownerId, loginKey, authQuery]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (subTab === 'menu') return;
      if (subTab === 'kampanya') await fetchKampanyalar();
      else await fetchIsIlanlari();
    } finally {
      setRefreshing(false);
    }
  }, [subTab, fetchKampanyalar, fetchIsIlanlari]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ownerId || !loginKey || subTab === 'menu') return;
      setLoading(true);
      try {
        if (subTab === 'kampanya') await fetchKampanyalar();
        else await fetchIsIlanlari();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subTab, ownerId, loginKey, fetchKampanyalar, fetchIsIlanlari]);

  const openModal = (item) => {
    setDatePickerField(null);
    if (subTab === 'kampanya') {
      if (item) {
        setEditingId(item._id);
        setKampanyaForm({
          title: item.title || '',
          companyName: item.companyName || displayName || '',
          contactPhone: item.contactPhone || '',
          discountText: item.discountText || '',
          addressDistrict: item.address?.district || registeredDistrict || '',
          addressNeighborhood: item.address?.neighborhood || '',
          startDate: item.startDate || '',
          licenseExpiry: item.licenseExpiry || '',
          imageUrl: item.imageUrl || '',
        });
      } else {
        setEditingId('');
        setKampanyaForm(emptyKampanyaForm(displayName, registeredDistrict));
      }
    } else if (item) {
      setEditingId(item._id);
      setIsIlaniForm({
        title: item.title || '',
        company: item.company || displayName || '',
        description: item.description || '',
        contactPhone: item.contactPhone || '',
        contactEmail: item.contactEmail || '',
        addressDistrict: item.address?.district || registeredDistrict || '',
        addressNeighborhood: item.address?.neighborhood || '',
        imageUrl: item.imageUrl || '',
      });
    } else {
      setEditingId('');
      setIsIlaniForm(emptyIsIlaniForm(displayName, registeredDistrict));
    }
    setModalVisible(true);
  };

  const pickImage = async (setter) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tx('İzin'), 'Galeri erişimi gerekli.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setImageUploading(true);
      const formData = new FormData();
      formData.append('image', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      const res = await fetch(apiUrl('/api/upload/image'), { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) setter((p) => ({ ...p, imageUrl: data.url }));
      else Alert.alert(tx('Hata'), data.error || 'Yükleme başarısız.');
    } catch (e) {
      Alert.alert(tx('Hata'), 'Fotoğraf yüklenemedi.');
    } finally {
      setImageUploading(false);
    }
  };

  const applyDatePicker = (field, date, setter) => {
    let next = date;
    if (field === 'licenseExpiry') next = dateNotBeforeToday(next);
    setter((p) => ({ ...p, [field]: formatDateToStr(next) }));
    setDatePickerField(null);
  };

  const saveItem = async () => {
    const isKampanya = subTab === 'kampanya';
    const form = isKampanya ? kampanyaForm : isIlaniForm;
    if (!form.title.trim()) {
      Alert.alert(tx('Uyarı'), 'Başlık zorunlu.');
      return;
    }
    if (isKampanya) {
      const licErr = errorIfLicenseExpiryBeforeToday(form.licenseExpiry);
      if (licErr) {
        Alert.alert(tx('Geçersiz tarih'), licErr);
        return;
      }
    }
    setSaving(true);
    try {
      const body = {
        loginKey,
        title: form.title.trim(),
        companyName: isKampanya ? String(form.companyName || displayName || '').trim() : undefined,
        company: !isKampanya ? String(form.company || displayName || '').trim() : undefined,
        contactPhone: String(form.contactPhone || '').trim(),
        discountText: isKampanya ? String(form.discountText || '').trim() : undefined,
        description: !isKampanya ? String(form.description || '').trim() : undefined,
        contactEmail: !isKampanya ? String(form.contactEmail || '').trim() : undefined,
        startDate: isKampanya ? String(form.startDate || '').trim() : undefined,
        licenseExpiry: isKampanya ? String(form.licenseExpiry || '').trim() : undefined,
        imageUrl: String(form.imageUrl || '').trim(),
        active: true,
        ...buildAddressPayload(form, registeredDistrict),
      };
      const base = apiUrl(`/api/premium/${ownerType}/${ownerId}/${isKampanya ? 'kampanyalar' : 'isilanlari'}`);
      const url = editingId ? `${base}/${editingId}` : base;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert(tx('Hata'), data.error || 'Kaydedilemedi');
        return;
      }
      setModalVisible(false);
      setEditingId('');
      if (isKampanya) await fetchKampanyalar();
      else await fetchIsIlanlari();
    } catch (e) {
      Alert.alert(tx('Hata'), 'Bağlantı hatası');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (item) => {
    const title = String(item?.title || 'Kayıt').trim();
    Alert.alert(tx('Sil'), `"${title}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const kind = subTab === 'kampanya' ? 'kampanyalar' : 'isilanlari';
            const res = await fetch(
              apiUrl(`/api/premium/${ownerType}/${ownerId}/${kind}/${item._id}?${authQuery}`),
              { method: 'DELETE' }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              Alert.alert(tx('Hata'), data.error || 'Silinemedi');
              return;
            }
            if (subTab === 'kampanya') await fetchKampanyalar();
            else await fetchIsIlanlari();
          } catch (e) {
            Alert.alert(tx('Hata'), 'Bağlantı hatası');
          }
        },
      },
    ]);
  };

  const renderDateField = (field, label, form, setter) => {
    const dateStr = form[field] || '';
    return (
      <View key={field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TouchableOpacity
          style={styles.dateTouch}
          onPress={() => {
            let base = parseDateStr(dateStr);
            if (field === 'licenseExpiry') base = dateNotBeforeToday(base);
            setDatePickerTemp(base);
            setDatePickerField(field);
          }}
        >
          <Text style={[styles.dateTouchText, !dateStr && styles.datePlaceholder]}>
            {dateStr || 'Tarih seçin'}
          </Text>
          <Text style={styles.dateIcon}>📅</Text>
        </TouchableOpacity>
        {datePickerField === field ? (
          Platform.OS === 'ios' ? (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                value={datePickerTemp}
                mode="date"
                display="spinner"
                onChange={(_e, d) => d && setDatePickerTemp(d)}
              />
              <TouchableOpacity
                style={styles.datePickerOk}
                onPress={() => applyDatePicker(field, datePickerTemp, setter)}
              >
                <Text style={styles.datePickerOkText}>{tx('Tamam')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <DateTimePicker
              value={datePickerTemp}
              mode="date"
              display="default"
              onChange={(_e, d) => {
                if (d) applyDatePicker(field, d, setter);
                else setDatePickerField(null);
              }}
            />
          )
        ) : null}
      </View>
    );
  };

  const form = subTab === 'kampanya' ? kampanyaForm : isIlaniForm;
  const setForm = subTab === 'kampanya' ? setKampanyaForm : setIsIlaniForm;
  const listData = subTab === 'kampanya' ? kampanyalar : isIlanlari;

  return (
    <View style={styles.wrap}>
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'kampanya' && styles.subTabActive]}
          onPress={() => setSubTab('kampanya')}
        >
          <Text style={[styles.subTabText, subTab === 'kampanya' && styles.subTabTextActive]}>
            Kampanya/İndirim
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'isilan' && styles.subTabActive]}
          onPress={() => setSubTab('isilan')}
        >
          <Text style={[styles.subTabText, subTab === 'isilan' && styles.subTabTextActive]}>
            İş ilanları
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'menu' && styles.subTabActive]}
          onPress={() => setSubTab('menu')}
        >
          <Text style={[styles.subTabText, subTab === 'menu' && styles.subTabTextActive]}>
            Fotoğraf / PDF
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'menu' ? (
        <PremiumMenuEditor ownerType={ownerType} ownerId={ownerId} loginKey={loginKey} />
      ) : (
        <>
      <TouchableOpacity style={styles.addBtn} onPress={() => openModal(null)}>
        <Text style={styles.addBtnText}>
          {subTab === 'kampanya' ? '+ Yeni kampanya/indirim' : '+ Yeni iş ilanı'}
        </Text>
      </TouchableOpacity>

      {loading && !refreshing ? (
        <ActivityIndicator style={styles.spinner} color="#1B4D4A" />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1B4D4A']} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {subTab === 'kampanya' ? 'Henüz kampanya/indirim yok.' : 'Henüz iş ilanı yok.'}
            </Text>
          }
          renderItem={({ item }) => {
            const img = resolveImageUri(item.imageUrl);
            return (
              <View style={styles.card}>
                {img ? <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" /> : null}
                <Text style={styles.cardTitle}>{item.title}</Text>
                {subTab === 'kampanya' && item.discountText ? (
                  <Text style={styles.cardSub}>{item.discountText}</Text>
                ) : null}
                {subTab === 'isilan' && item.company ? (
                  <Text style={styles.cardSub}>{item.company}</Text>
                ) : null}
                {subTab === 'kampanya' && item.licenseExpiry ? (
                  <Text style={styles.cardMeta}>Bitiş: {item.licenseExpiry}</Text>
                ) : null}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openModal(item)}>
                    <Text style={styles.editBtnText}>{tx('Düzenle')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.delBtn} onPress={() => deleteItem(item)}>
                    <Text style={styles.delBtnText}>{tx('Sil')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
        </>
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingId
                ? (subTab === 'kampanya' ? 'Kampanya/indirimi düzenle' : 'İş ilanını düzenle')
                : (subTab === 'kampanya' ? 'Yeni kampanya/indirim' : 'Yeni iş ilanı')}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              contentContainerStyle={styles.modalScrollContent}
            >
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
                placeholder={tx('Başlık *')}
              />
              {subTab === 'kampanya' ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={form.companyName}
                    onChangeText={(v) => setForm((p) => ({ ...p, companyName: v }))}
                    placeholder={tx('İşletme adı')}
                  />
                  <TextInput
                    style={styles.input}
                    value={form.discountText}
                    onChangeText={(v) => setForm((p) => ({ ...p, discountText: v }))}
                    placeholder={tx('İndirim metni')}
                  />
                  <TextInput
                    style={styles.input}
                    value={form.contactPhone}
                    onChangeText={(v) => setForm((p) => ({ ...p, contactPhone: v.replace(/[^\d]/g, '') }))}
                    placeholder={tx('İletişim telefonu')}
                    keyboardType="number-pad"
                  />
                  {renderDateField('startDate', 'Kampanya başlangıç tarihi', form, setForm)}
                  {renderDateField('licenseExpiry', 'Kampanya bitiş tarihi', form, setForm)}
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={form.company}
                    onChangeText={(v) => setForm((p) => ({ ...p, company: v }))}
                    placeholder="Firma / işletme adı"
                  />
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={form.description}
                    onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                    placeholder={tx('Açıklama')}
                    multiline
                  />
                  <TextInput
                    style={styles.input}
                    value={form.contactPhone}
                    onChangeText={(v) => setForm((p) => ({ ...p, contactPhone: v.replace(/[^\d]/g, '') }))}
                    placeholder={tx('İletişim telefonu')}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.input}
                    value={form.contactEmail}
                    onChangeText={(v) => setForm((p) => ({ ...p, contactEmail: v }))}
                    placeholder={tx('İletişim e-posta')}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </>
              )}
              <Text style={styles.fieldLabel}>{tx('İlçe')}</Text>
              <TextInput
                style={styles.input}
                value={form.addressDistrict}
                onChangeText={(v) => setForm((p) => ({ ...p, addressDistrict: v }))}
                placeholder={registeredDistrict || 'İlçe'}
              />
              <Text style={styles.fieldLabel}>{tx('Mahalle')}</Text>
              <TextInput
                style={styles.input}
                value={form.addressNeighborhood}
                onChangeText={(v) => setForm((p) => ({ ...p, addressNeighborhood: v }))}
                placeholder={tx('Mahalle')}
              />
              {form.imageUrl ? (
                <Image source={{ uri: resolveImageUri(form.imageUrl) }} style={styles.formThumb} resizeMode="cover" />
              ) : null}
              <TouchableOpacity
                style={[styles.uploadBtn, imageUploading && styles.uploadBtnDisabled]}
                onPress={() => pickImage(setForm)}
                disabled={imageUploading}
              >
                {imageUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.uploadBtnText}>Fotoğraf seç</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text>{tx('İptal')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveItem} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{tx('Kaydet')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  subTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: '#1B4D4A' },
  subTabText: { fontSize: 14, color: '#666' },
  subTabTextActive: { color: '#1B4D4A', fontWeight: '600' },
  addBtn: {
    margin: 12,
    padding: 12,
    backgroundColor: '#1B4D4A',
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  spinner: { marginTop: 24 },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  empty: { textAlign: 'center', color: '#888', marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  thumb: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#222' },
  cardSub: { fontSize: 14, color: '#555', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  cardActions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  editBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f0f0f0', borderRadius: 6 },
  editBtnText: { color: '#333' },
  delBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#ffecec', borderRadius: 6 },
  delBtnText: { color: '#c00' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '92%' },
  modalScrollContent: { paddingBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  dateTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  dateTouchText: { fontSize: 15, color: '#222' },
  datePlaceholder: { color: '#999' },
  dateIcon: { fontSize: 16 },
  datePickerWrap: { marginBottom: 10 },
  datePickerOk: { alignItems: 'center', padding: 8 },
  datePickerOkText: { color: '#1B4D4A', fontWeight: '600' },
  formThumb: { width: '100%', height: 100, borderRadius: 8, marginBottom: 8 },
  uploadBtn: {
    backgroundColor: '#1B4D4A',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  cancelBtn: { padding: 10 },
  saveBtn: { backgroundColor: '#1B4D4A', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
});
