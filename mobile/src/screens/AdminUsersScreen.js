import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiUrl } from '../config/api';
import { useLanguage } from '../i18n/LanguageContext';


function parseDateStr(str) {
  if (!str || typeof str !== 'string') return new Date();
  const match = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
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

const SORT_KEYS = {
  memberId: 'memberId',
  displayName: 'displayName',
  yearTotal: 'yearTotal',
  monthTotal: 'monthTotal',
  yearSuccess: 'yearSuccess',
  yearFail: 'yearFail',
};

const TEXT_SORT_KEYS = new Set([SORT_KEYS.memberId, SORT_KEYS.displayName]);

function parseBusinessList(data) {
  const raw = Array.isArray(data?.list) ? data.list : [];
  return raw.map((b) => {
    if (b.id != null && b.label != null) {
      return { id: String(b.id), label: String(b.label) };
    }
    const name = b.businessName || String(b._id);
    const suffix = b.approved === false ? ' (onaysız)' : '';
    return { id: String(b._id), label: name + suffix };
  });
}

async function fetchAdminJson(path, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(path), { cache: 'no-store', signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

function compareUsers(a, b, sortKey, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  if (sortKey === SORT_KEYS.memberId) {
    return dir * String(a.memberId || '').localeCompare(String(b.memberId || ''), 'tr');
  }
  if (sortKey === SORT_KEYS.displayName) {
    return dir * String(a.displayName || '').localeCompare(String(b.displayName || ''), 'tr');
  }
  const statKey = sortKey;
  const av = Number(a.stats?.[statKey]) || 0;
  const bv = Number(b.stats?.[statKey]) || 0;
  return dir * (av - bv);
}

function SortableHeader({ label, columnKey, sortKey, sortDir, onSort, cellStyle, textStyle, alignLeft }) {
  const active = sortKey === columnKey;
  const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <TouchableOpacity
      style={[cellStyle, active && styles.headerCellActive]}
      onPress={() => onSort(columnKey)}
      activeOpacity={0.7}
    >
      <Text
        style={[textStyle, alignLeft && styles.headerCellLeft, active && styles.headerCellActiveText]}
        numberOfLines={1}
      >
        {label}
        {arrow}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminUsersScreen({ navigation }) {
  const { tx } = useLanguage();
  const [users, setUsers] = useState([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [discountUser, setDiscountUser] = useState(null);
  const [businessOptions, setBusinessOptions] = useState([]);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessLoadError, setBusinessLoadError] = useState(null);
  const [businessPickerOpen, setBusinessPickerOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    business: '',
    title: '',
    description: '',
    discountPercent: '',
    validUntil: '',
    active: true,
  });
  const [discountSaving, setDiscountSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerTemp, setDatePickerTemp] = useState(new Date());
  const [sortKey, setSortKey] = useState(SORT_KEYS.displayName);
  const [sortDir, setSortDir] = useState('asc');

  const onSortColumn = useCallback((columnKey) => {
    setSortKey((prevKey) => {
      if (prevKey === columnKey) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDir(TEXT_SORT_KEYS.has(columnKey) ? 'asc' : 'desc');
      return columnKey;
    });
  }, []);

  const sortedUsers = useMemo(() => {
    if (!sortKey) return users;
    return [...users].sort((a, b) => compareUsers(a, b, sortKey, sortDir));
  }, [users, sortKey, sortDir]);

  const loadBusinessOptions = useCallback(async () => {
    setBusinessLoadError(null);
    setBusinessLoading(true);
    try {
      const urls = [
        '/api/admin/isletme',
        '/api/admin/isletme?forPicker=1',
        '/api/admin/businesses-picker',
      ];
      let items = [];
      let lastError = '';

      for (const path of urls) {
        let res;
        let data;
        try {
          ({ res, data } = await fetchAdminJson(path));
        } catch {
          lastError = 'Sunucuya bağlanılamadı (zaman aşımı)';
          continue;
        }
        if (!res.ok) {
          lastError = data.error || 'İşletme listesi alınamadı';
          continue;
        }
        items = parseBusinessList(data);
        if (items.length > 0) break;
      }

      setBusinessOptions(items);
      if (items.length === 0) {
        setBusinessLoadError(
          lastError || 'Kayıtlı işletme yok. Admin panelden işletme ekleyin.'
        );
      }
    } catch {
      setBusinessOptions([]);
      setBusinessLoadError('Sunucuya bağlanılamadı. api.js içinde bilgisayar IP adresinizi kontrol edin.');
    } finally {
      setBusinessLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/admin/users-reservation-stats'), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Liste alınamadı');
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPeriodLabel(data.periodLabel || '');
    } catch {
      setError('Bağlantı hatası');
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const openDiscountModal = (user) => {
    if (!user?.memberId) {
      Alert.alert(tx('Üye numarası yok'), 'Bu kullanıcının henüz üye numarası oluşturulmamış. Listeyi yenileyin.');
      return;
    }
    setDiscountUser(user);
    setDiscountForm({
      business: '',
      title: '',
      description: '',
      discountPercent: '',
      validUntil: '',
      active: true,
    });
    setBusinessPickerOpen(false);
    setDatePickerVisible(false);
    setDiscountModalVisible(true);
  };

  const openBusinessPicker = () => {
    closeDatePicker();
    setBusinessPickerOpen(true);
    loadBusinessOptions();
  };

  const closeBusinessPicker = () => {
    setBusinessPickerOpen(false);
  };

  const openDatePicker = () => {
    closeBusinessPicker();
    setDatePickerTemp(parseDateStr(discountForm.validUntil));
    setDatePickerVisible(true);
  };

  const closeDatePicker = () => {
    setDatePickerVisible(false);
  };

  const confirmDatePicker = () => {
    setDiscountForm((p) => ({ ...p, validUntil: formatDateToStr(datePickerTemp) }));
    closeDatePicker();
  };

  const saveDiscount = async () => {
    if (!discountUser?.memberId) return;
    if (!discountForm.business) {
      Alert.alert(tx('Uyarı'), 'İşletme seçin.');
      return;
    }
    setDiscountSaving(true);
    try {
      const res = await fetch(apiUrl('/api/admin/uye_indirimi'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: discountUser.memberId,
          business: discountForm.business,
          title: (discountForm.title || '').trim(),
          description: (discountForm.description || '').trim(),
          discountPercent: (discountForm.discountPercent || '').trim(),
          validUntil: (discountForm.validUntil || '').trim(),
          active: discountForm.active !== false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDiscountModalVisible(false);
        Alert.alert(tx('Başarılı'), `${discountUser.memberId} için indirim tanımlandı.`);
      } else {
        Alert.alert(tx('Hata'), data.message ? `${data.error || 'Kaydedilemedi'}\n${data.message}` : (data.error || 'Kaydedilemedi'));
      }
    } catch {
      Alert.alert(tx('Hata'), 'Bağlantı hatası');
    } finally {
      setDiscountSaving(false);
    }
  };

  const selectedBusiness = businessOptions.find((o) => o.id === discountForm.business);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1B4D4A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Admin</Text>
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>{tx('Kullanıcılar')}</Text>
        <View style={styles.toolbarSpacer} />
      </View>

      {periodLabel ? (
        <Text style={styles.periodHint}>
          Rezervasyon sayıları: {periodLabel}. Başarılı = tamamlanan; başarısız = red / gelmedi / iptal (bu yıl).
          {'\n'}Sıralamak için kolon başlığına dokunun (tekrar dokununca yön değişir).
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUsers}>
            <Text style={styles.retryBtnText}>Yeniden dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.mainScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4D4A']} />
        }
      >
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.tableWrap}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <SortableHeader
                label="Üye no"
                columnKey={SORT_KEYS.memberId}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSortColumn}
                cellStyle={[styles.cell, styles.cellId]}
                textStyle={styles.headerCell}
                alignLeft
              />
              <SortableHeader
                label="Ad Soyad"
                columnKey={SORT_KEYS.displayName}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSortColumn}
                cellStyle={[styles.cell, styles.cellName]}
                textStyle={styles.headerCell}
                alignLeft
              />
              <SortableHeader
                label="Bu yıl"
                columnKey={SORT_KEYS.yearTotal}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSortColumn}
                cellStyle={[styles.cell, styles.cellNum]}
                textStyle={styles.headerCell}
              />
              <SortableHeader
                label="Bu ay"
                columnKey={SORT_KEYS.monthTotal}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSortColumn}
                cellStyle={[styles.cell, styles.cellNum]}
                textStyle={styles.headerCell}
              />
              <SortableHeader
                label="Başarılı"
                columnKey={SORT_KEYS.yearSuccess}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSortColumn}
                cellStyle={[styles.cell, styles.cellNumWide]}
                textStyle={styles.headerCell}
              />
              <SortableHeader
                label="Başarısız"
                columnKey={SORT_KEYS.yearFail}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSortColumn}
                cellStyle={[styles.cell, styles.cellNumWide]}
                textStyle={styles.headerCell}
              />
              <Text style={[styles.cell, styles.cellAction, styles.headerCell]} numberOfLines={1}>İşlem</Text>
            </View>
            {sortedUsers.length === 0 ? (
              <Text style={styles.emptyText}>Kayıtlı kullanıcı yok.</Text>
            ) : (
              sortedUsers.map((u) => (
                <View key={u.id} style={styles.tableRow}>
                  <Text
                    style={[styles.cell, styles.cellId, styles.cellIdValue]}
                    selectable
                  >
                    {u.memberId || '—'}
                  </Text>
                  <Text style={[styles.cell, styles.cellName]} numberOfLines={2}>
                    {u.displayName}
                  </Text>
                  <Text style={[styles.cell, styles.cellNum]}>{u.stats?.yearTotal ?? 0}</Text>
                  <Text style={[styles.cell, styles.cellNum]}>{u.stats?.monthTotal ?? 0}</Text>
                  <Text style={[styles.cell, styles.cellNumWide, styles.successNum]}>{u.stats?.yearSuccess ?? 0}</Text>
                  <Text style={[styles.cell, styles.cellNumWide, styles.failNum]}>{u.stats?.yearFail ?? 0}</Text>
                  <View style={[styles.cell, styles.cellAction]}>
                    <TouchableOpacity
                      style={styles.discountBtn}
                      onPress={() => openDiscountModal(u)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.discountBtnText}>İndirim tanımla</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </ScrollView>

      <Modal visible={discountModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setDiscountModalVisible(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Üye indirimi tanımla</Text>
            <Text style={styles.modalSub}>
              {discountUser?.displayName} — {discountUser?.memberId}
            </Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Üye numarası</Text>
              <Text style={styles.readonlyValue}>{discountUser?.memberId || '—'}</Text>

              <Text style={styles.fieldLabel}>İşletme *</Text>
              <TouchableOpacity style={styles.selectTouch} onPress={openBusinessPicker}>
                <Text style={[styles.selectTouchText, !selectedBusiness && styles.placeholder]}>
                  {selectedBusiness ? selectedBusiness.label : 'İşletme seçin'}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>{tx('İndirim başlığı')}</Text>
              <TextInput
                style={styles.input}
                value={discountForm.title}
                onChangeText={(t) => setDiscountForm((p) => ({ ...p, title: t }))}
                placeholder="Örn. %10 indirim"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>{tx('Açıklama')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={discountForm.description}
                onChangeText={(t) => setDiscountForm((p) => ({ ...p, description: t }))}
                placeholder="İsteğe bağlı"
                placeholderTextColor="#999"
                multiline
              />

              <Text style={styles.fieldLabel}>İndirim yüzdesi</Text>
              <TextInput
                style={styles.input}
                value={discountForm.discountPercent}
                onChangeText={(t) => setDiscountForm((p) => ({ ...p, discountPercent: t.replace(/[^0-9]/g, '') }))}
                keyboardType="number-pad"
                placeholder="0–100"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Geçerlilik bitiş</Text>
              <TouchableOpacity style={styles.selectTouch} onPress={openDatePicker}>
                <Text style={[styles.selectTouchText, !discountForm.validUntil && styles.placeholder]}>
                  {discountForm.validUntil || 'Tarih seçin'}
                </Text>
                <Text style={styles.selectArrow}>📅</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setDiscountForm((p) => ({ ...p, active: !p.active }))}
              >
                <View style={[styles.checkbox, discountForm.active && styles.checkboxOn]}>
                  {discountForm.active ? <Text style={styles.checkboxTick}>✓</Text> : null}
                </View>
                <Text style={styles.checkboxLabel}>Aktif</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDiscountModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{tx('Vazgeç')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, discountSaving && styles.saveBtnDisabled]}
                onPress={saveDiscount}
                disabled={discountSaving}
              >
                {discountSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{tx('Kaydet')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {datePickerVisible ? (
            <View style={styles.pickerLayer}>
              <Pressable style={styles.pickerOverlay} onPress={closeDatePicker} />
              <View style={styles.pickerBox}>
                <Text style={styles.pickerTitle}>Geçerlilik bitiş tarihi</Text>
                <DateTimePicker
                  value={datePickerTemp}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') {
                      closeDatePicker();
                      if (event.type === 'set' && date) {
                        setDiscountForm((p) => ({ ...p, validUntil: formatDateToStr(date) }));
                      }
                      return;
                    }
                    if (date) setDatePickerTemp(date);
                  }}
                  locale="tr-TR"
                  style={styles.datePickerControl}
                />
                {Platform.OS === 'ios' ? (
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity style={styles.dateCancelBtn} onPress={closeDatePicker}>
                      <Text style={styles.dateCancelBtnText}>{tx('Vazgeç')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateDoneBtn} onPress={confirmDatePicker}>
                      <Text style={styles.dateDoneBtnText}>{tx('Tamam')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.pickerClose} onPress={closeDatePicker}>
                    <Text style={styles.pickerCloseText}>{tx('Kapat')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}

          {businessPickerOpen ? (
            <View style={styles.pickerLayer}>
              <Pressable style={styles.pickerOverlay} onPress={closeBusinessPicker} />
              <View style={styles.pickerBox}>
                <Text style={styles.pickerTitle}>{tx('İşletme seçin')}</Text>
                <Text style={styles.pickerSub}>
                  {businessLoading
                    ? 'Yükleniyor…'
                    : businessOptions.length > 0
                      ? `${businessOptions.length} işletme`
                      : businessLoadError
                        ? ''
                        : 'Liste boş'}
                </Text>
                {businessLoading ? (
                  <ActivityIndicator style={styles.pickerLoading} color="#1B4D4A" />
                ) : businessLoadError ? (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>{businessLoadError}</Text>
                    <TouchableOpacity style={styles.pickerRetryBtn} onPress={loadBusinessOptions}>
                      <Text style={styles.pickerRetryText}>Yeniden dene</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
                    {businessOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.pickerItem,
                          discountForm.business === opt.id && styles.pickerItemSelected,
                        ]}
                        onPress={() => {
                          setDiscountForm((p) => ({ ...p, business: opt.id }));
                          closeBusinessPicker();
                        }}
                      >
                        <Text style={styles.pickerItemText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <TouchableOpacity style={styles.pickerClose} onPress={closeBusinessPicker}>
                  <Text style={styles.pickerCloseText}>{tx('Kapat')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: { paddingVertical: 10, paddingRight: 12, marginTop: 4 },
  backBtnText: { color: '#1B4D4A', fontSize: 16, fontWeight: '600' },
  toolbarTitle: { fontSize: 18, fontWeight: '700', color: '#333', flex: 1, textAlign: 'center' },
  toolbarSpacer: { width: 72 },
  periodHint: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 10,
    lineHeight: 17,
  },
  errorBox: {
    margin: 16,
    padding: 14,
    backgroundColor: '#fff0f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: { color: '#c00', marginBottom: 10 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B4D4A',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  mainScroll: { flex: 1 },
  tableWrap: { width: 728, paddingBottom: 24 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    minHeight: 52,
  },
  tableHeaderRow: {
    backgroundColor: '#e8f5e9',
    borderBottomWidth: 2,
    borderBottomColor: '#a5d6a7',
    minHeight: 40,
  },
  headerCell: {
    fontWeight: '700',
    color: '#1b5e20',
    fontSize: 11,
    textAlign: 'center',
  },
  headerCellLeft: { textAlign: 'left' },
  headerCellActive: {
    backgroundColor: '#c8e6c9',
    borderRadius: 6,
  },
  headerCellActiveText: { color: '#0d3d12' },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    fontSize: 13,
    color: '#333',
    flexShrink: 0,
  },
  cellId: {
    width: 116,
    textAlign: 'left',
  },
  cellIdValue: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    color: '#1b5e20',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cellName: { width: 118, textAlign: 'left' },
  cellNum: { width: 62, textAlign: 'center' },
  cellNumWide: { width: 76, textAlign: 'center' },
  cellAction: { width: 128, paddingRight: 8, textAlign: 'center' },
  successNum: { color: '#2e7d32', fontWeight: '700' },
  failNum: { color: '#c62828', fontWeight: '700' },
  discountBtn: {
    backgroundColor: '#1B4D4A',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  discountBtnText: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  emptyText: { padding: 24, textAlign: 'center', color: '#888', width: 600 },
  modalRoot: { flex: 1, justifyContent: 'center', position: 'relative' },
  pickerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    justifyContent: 'flex-end',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalBox: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', padding: 16, paddingBottom: 4, color: '#333' },
  modalSub: { fontSize: 14, color: '#666', paddingHorizontal: 16, marginBottom: 8 },
  modalScroll: { paddingHorizontal: 16, maxHeight: 360 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 10 },
  readonlyValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#1b5e20',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  selectTouchText: { flex: 1, fontSize: 15, color: '#333' },
  placeholder: { color: '#999' },
  selectArrow: { color: '#666', marginLeft: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#1B4D4A', borderColor: '#1B4D4A' },
  checkboxTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 15, color: '#333' },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1B4D4A',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '55%',
    paddingBottom: 20,
    zIndex: 21,
    elevation: 21,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, color: '#333' },
  pickerSub: { fontSize: 13, color: '#666', paddingHorizontal: 16, paddingBottom: 8 },
  pickerLoading: { paddingVertical: 32 },
  pickerEmpty: { padding: 20, alignItems: 'center' },
  pickerEmptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 12 },
  pickerRetryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1B4D4A',
    borderRadius: 8,
  },
  pickerRetryText: { color: '#fff', fontWeight: '600' },
  pickerScroll: { maxHeight: 320 },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  pickerItemSelected: { backgroundColor: '#e8f5e9' },
  pickerItemText: { fontSize: 16, color: '#333' },
  pickerClose: { padding: 16, alignItems: 'center' },
  pickerCloseText: { color: '#1B4D4A', fontWeight: '700', fontSize: 16 },
  datePickerControl: { alignSelf: 'stretch' },
  datePickerActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  dateCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  dateCancelBtnText: { color: '#666', fontWeight: '600', fontSize: 16 },
  dateDoneBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1B4D4A',
    alignItems: 'center',
  },
  dateDoneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
