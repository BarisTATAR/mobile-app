import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';


const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  android: { elevation: 3 },
});

export default function MapListingPin({ color = '#1B4D4A', shape = 'circle', icon = null, size = 22 }) {
  const { tx } = useLanguage();
  const border = 2;
  const inner = Math.max(8, size - border * 2);

  if (shape === 'square') {
    return (
      <View style={[styles.center, { width: size, height: size }]}>
        <View style={[styles.square, { width: inner, height: inner, backgroundColor: color, borderWidth: border }, shadow]}>
          {icon ? <Text style={[styles.icon, { fontSize: inner * 0.55 }]}>{icon}</Text> : null}
        </View>
      </View>
    );
  }

  if (shape === 'diamond') {
    const d = inner * 0.72;
    return (
      <View style={[styles.center, { width: size, height: size }]}>
        <View
          style={[
            styles.diamond,
            {
              width: d,
              height: d,
              backgroundColor: color,
              borderWidth: border,
            },
            shadow,
          ]}
        >
          {icon ? <Text style={[styles.icon, { fontSize: d * 0.45, transform: [{ rotate: '-45deg' }] }]}>{icon}</Text> : null}
        </View>
      </View>
    );
  }

  if (shape === 'triangle') {
    return (
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.triangle, { fontSize: size, color }, shadow]}>▲</Text>
        {icon ? <Text style={[styles.triangleIcon, { fontSize: size * 0.38 }]}>{icon}</Text> : null}
      </View>
    );
  }

  if (shape === 'ring') {
    const hole = Math.max(4, inner * 0.42);
    return (
      <View style={[styles.center, { width: size, height: size }]}>
        <View
          style={[
            styles.ring,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: color,
              borderWidth: border,
            },
            shadow,
          ]}
        >
          {icon ? (
            <Text style={[styles.icon, { fontSize: inner * 0.38 }]}>{icon}</Text>
          ) : (
            <View
              style={{
                width: hole,
                height: hole,
                borderRadius: hole / 2,
                backgroundColor: '#fff',
              }}
            />
          )}
        </View>
      </View>
    );
  }

  if (shape === 'pill') {
    return (
      <View style={[styles.center, { width: size + 6, height: size }]}>
        <View
          style={[
            styles.pill,
            {
              width: inner + 6,
              height: inner * 0.72,
              backgroundColor: color,
              borderWidth: border,
            },
            shadow,
          ]}
        >
          {icon ? <Text style={[styles.icon, { fontSize: inner * 0.45 }]}>{icon}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: color,
            borderWidth: border,
          },
          shadow,
        ]}
      >
        {icon ? <Text style={[styles.icon, { fontSize: inner * 0.5 }]}>{icon}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  circle: { borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  square: { borderColor: '#fff', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  diamond: {
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pill: { borderColor: '#fff', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  triangle: { textAlign: 'center', includeFontPadding: false, marginTop: -2 },
  triangleIcon: { position: 'absolute', top: 2 },
  icon: { textAlign: 'center' },
});
