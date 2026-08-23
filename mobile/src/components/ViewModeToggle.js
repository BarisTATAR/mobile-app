import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ViewModeToggle({ viewMode, onChange }) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.chip, viewMode === 'list' && styles.chipActive]}
        onPress={() => onChange('list')}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, viewMode === 'list' && styles.chipTextActive]}>Liste</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, viewMode === 'map' && styles.chipActive]}
        onPress={() => onChange('map')}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, viewMode === 'map' && styles.chipTextActive]}>Harita</Text>
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
    borderColor: '#34C759',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#34C759',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34C759',
  },
  chipTextActive: {
    color: '#fff',
  },
});
