import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { formatDateWithSlashes } from '../utils/dateInput';

function digitsOf(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8);
}

export default function DateSlashInput({ value, onChange, testID }) {
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const d = digitsOf(value);
  const day = d.slice(0, 2);
  const month = d.slice(2, 4);
  const year = d.slice(4, 8);

  const emit = (nextDigits) => {
    onChange(formatDateWithSlashes(nextDigits));
  };

  return (
    <View testID={testID} style={styles.row}>
      <TextInput
        testID={testID ? `${testID}-day` : undefined}
        style={styles.box}
        value={day}
        onChangeText={(t) => {
          const next = String(t).replace(/\D/g, '').slice(0, 2);
          emit(next + month + year);
          if (next.length === 2) monthRef.current?.focus();
        }}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="GG"
        placeholderTextColor="#999"
      />
      <Text style={styles.slash}>/</Text>
      <TextInput
        ref={monthRef}
        testID={testID ? `${testID}-month` : undefined}
        style={styles.box}
        value={month}
        onChangeText={(t) => {
          const next = String(t).replace(/\D/g, '').slice(0, 2);
          emit(day + next + year);
          if (next.length === 2) yearRef.current?.focus();
        }}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="AA"
        placeholderTextColor="#999"
      />
      <Text style={styles.slash}>/</Text>
      <TextInput
        ref={yearRef}
        testID={testID ? `${testID}-year` : undefined}
        style={[styles.box, styles.year]}
        value={year}
        onChangeText={(t) => {
          const next = String(t).replace(/\D/g, '').slice(0, 4);
          emit(day + month + next);
        }}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="YYYY"
        placeholderTextColor="#999"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  box: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  year: {
    flex: 1.4,
  },
  slash: {
    fontSize: 22,
    fontWeight: '700',
    color: '#34C759',
    marginHorizontal: 8,
  },
});
