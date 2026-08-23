import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function NearbySortButton({ active, loading, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.btn, active && styles.btnActive]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={active ? '#fff' : '#34C759'} size="small" />
      ) : (
        <Text style={[styles.btnText, active && styles.btnTextActive]}>
          {active ? 'Yakından uzağa ✓' : 'Yakından uzağa göster'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#34C759',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  btnActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34C759',
  },
  btnTextActive: {
    color: '#fff',
  },
});
