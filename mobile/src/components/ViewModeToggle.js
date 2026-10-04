import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';


export default function ViewModeToggle({ viewMode, onChange }) {
  const { tx } = useLanguage();
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.chip, viewMode === 'list' && styles.chipActive]}
        onPress={() => onChange('list')}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, viewMode === 'list' && styles.chipTextActive]}>{tx('Liste')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, viewMode === 'map' && styles.chipActive]}
        onPress={() => onChange('map')}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, viewMode === 'map' && styles.chipTextActive]}>{tx('Harita')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
    width: '100%',
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1B4D4A',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#1B4D4A',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4D4A',
  },
  chipTextActive: {
    color: '#fff',
  },
});
