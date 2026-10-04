import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';


export default function NearbySortButton({ active, loading, onPress }) {
  const { tx } = useLanguage();
  return (
    <TouchableOpacity
      style={[styles.btn, active && styles.btnActive]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={active ? '#fff' : '#1B4D4A'} size="small" />
      ) : (
        <Text style={[styles.btnText, active && styles.btnTextActive]}>
          {active ? tx('Yakından uzağa ✓') : tx('Yakından uzağa göster')}
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
    borderColor: '#1B4D4A',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  btnActive: {
    backgroundColor: '#1B4D4A',
    borderColor: '#1B4D4A',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B4D4A',
  },
  btnTextActive: {
    color: '#fff',
  },
});
