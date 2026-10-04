import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { apiUrl } from '../config/api';
import { useLanguage } from '../i18n/LanguageContext';


function SectionHeader({ label, count, expanded, onPress, level }) {
  const indent = level * 14;
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { paddingLeft: 12 + indent }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.sectionArrow}>{expanded ? '▼' : '▶'}</Text>
      <Text style={styles.sectionTitle} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminUsersByAddressScreen({ navigation }) {
  const { tx } = useLanguage();
  const [tree, setTree] = useState([]);
  const [summary, setSummary] = useState({ cityCount: 0, districtCount: 0, neighborhoodCount: 0 });
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCities, setExpandedCities] = useState({});
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const [expandedNeighborhoods, setExpandedNeighborhoods] = useState({});

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/admin/users-by-address'), { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Liste alınamadı');
        setTree([]);
        return;
      }
      setTree(Array.isArray(data.tree) ? data.tree : []);
      setSummary(data.summary || { cityCount: 0, districtCount: 0, neighborhoodCount: 0 });
      setTotalUsers(data.totalUsers ?? 0);
    } catch {
      setError('Bağlantı hatası');
      setTree([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const toggleCity = (city) => {
    setExpandedCities((prev) => ({ ...prev, [city]: !prev[city] }));
  };

  const toggleDistrict = (key) => {
    setExpandedDistricts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleNeighborhood = (key) => {
    setExpandedNeighborhoods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const cities = {};
    const districts = {};
    const neighborhoods = {};
    tree.forEach((c) => {
      cities[c.city] = true;
      c.districts.forEach((d) => {
        const dk = `${c.city}|${d.district}`;
        districts[dk] = true;
        d.neighborhoods.forEach((n) => {
          neighborhoods[`${c.city}|${d.district}|${n.neighborhood}`] = true;
        });
      });
    });
    setExpandedCities(cities);
    setExpandedDistricts(districts);
    setExpandedNeighborhoods(neighborhoods);
  };

  const collapseAll = () => {
    setExpandedCities({});
    setExpandedDistricts({});
    setExpandedNeighborhoods({});
  };

  if (loading) {
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
        <Text style={styles.toolbarTitle}>{tx('Kullanıcı adresleri')}</Text>
        <View style={styles.toolbarSpacer} />
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardMain]}>
          <Text style={styles.summaryValue}>{totalUsers}</Text>
          <Text style={styles.summaryLabel}>Toplam kullanıcı</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.cityCount}</Text>
          <Text style={styles.summaryLabel}>İl</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.districtCount}</Text>
          <Text style={styles.summaryLabel}>{tx('İlçe')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{summary.neighborhoodCount}</Text>
          <Text style={styles.summaryLabel}>{tx('Mahalle')}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionChip} onPress={expandAll}>
          <Text style={styles.actionChipText}>Tümünü aç</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={collapseAll}>
          <Text style={styles.actionChipText}>Tümünü kapat</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryBtnText}>Yeniden dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B4D4A']} />}
      >
        {tree.length === 0 ? (
          <Text style={styles.emptyText}>Kayıtlı kullanıcı yok.</Text>
        ) : (
          tree.map((cityNode) => {
            const cityOpen = !!expandedCities[cityNode.city];
            return (
              <View key={cityNode.city} style={styles.cityBlock}>
                <SectionHeader
                  label={`İl: ${cityNode.city}`}
                  count={cityNode.count}
                  expanded={cityOpen}
                  onPress={() => toggleCity(cityNode.city)}
                  level={0}
                />
                {cityOpen
                  ? cityNode.districts.map((distNode) => {
                      const distKey = `${cityNode.city}|${distNode.district}`;
                      const distOpen = !!expandedDistricts[distKey];
                      return (
                        <View key={distKey}>
                          <SectionHeader
                            label={`İlçe: ${distNode.district}`}
                            count={distNode.count}
                            expanded={distOpen}
                            onPress={() => toggleDistrict(distKey)}
                            level={1}
                          />
                          {distOpen
                            ? distNode.neighborhoods.map((nbNode) => {
                                const nbKey = `${distKey}|${nbNode.neighborhood}`;
                                const nbOpen = !!expandedNeighborhoods[nbKey];
                                return (
                                  <View key={nbKey}>
                                    <SectionHeader
                                      label={`Mahalle: ${nbNode.neighborhood}`}
                                      count={nbNode.count}
                                      expanded={nbOpen}
                                      onPress={() => toggleNeighborhood(nbKey)}
                                      level={2}
                                    />
                                    {nbOpen
                                      ? nbNode.users.map((u) => (
                                          <View key={u.id} style={styles.userRow}>
                                            <Text style={styles.userName}>{u.displayName}</Text>
                                            {u.memberId ? (
                                              <Text style={styles.userMeta}>Üye: {u.memberId}</Text>
                                            ) : null}
                                            {u.username ? (
                                              <Text style={styles.userMeta}>@{u.username}</Text>
                                            ) : null}
                                            {u.phone ? (
                                              <Text style={styles.userMeta}>📞 {u.phone}</Text>
                                            ) : null}
                                          </View>
                                        ))
                                      : null}
                                  </View>
                                );
                              })
                            : null}
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F1EB' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backBtnText: { fontSize: 16, color: '#1B4D4A', fontWeight: '600' },
  toolbarTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#222', textAlign: 'center' },
  toolbarSpacer: { width: 72 },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  summaryCardMain: {
    flexBasis: '100%',
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
  },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#2e7d32' },
  summaryLabel: { fontSize: 11, color: '#555', marginTop: 2, textAlign: 'center' },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  actionChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1B4D4A',
  },
  actionChipText: { fontSize: 13, fontWeight: '600', color: '#2e7d32' },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: { color: '#c62828', fontSize: 14 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryBtnText: { color: '#1B4D4A', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 24 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 24, fontSize: 15 },
  cityBlock: {
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionArrow: { fontSize: 12, color: '#666', width: 18 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  countBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1B4D4A',
    alignItems: 'center',
  },
  countBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  userRow: {
    paddingVertical: 10,
    paddingLeft: 56,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  userName: { fontSize: 15, fontWeight: '600', color: '#222' },
  userMeta: { fontSize: 13, color: '#666', marginTop: 2 },
});
