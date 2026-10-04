import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { colors } from '../theme';

export default function LanguageSwitcher({
  compact = false,
  light = false,
  value,
  onChange,
  testIDPrefix = '',
}) {
  const { lang: accountLang, setLang, t } = useLanguage();
  const lang = value || accountLang;
  const apply = onChange || setLang;
  const tid = (id) => (testIDPrefix ? `${testIDPrefix}-${id}` : id);
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityRole="tablist">
      {compact ? null : <Text style={[styles.label, light && styles.labelLight]}>{t('lang.label')}</Text>}
      <View style={[styles.seg, light && styles.segLight]}>
        <TouchableOpacity
          testID={tid('lang-tr')}
          style={[styles.btn, lang === 'tr' && styles.btnOn]}
          onPress={() => apply('tr')}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, lang === 'tr' && styles.btnTextOn]}>{t('lang.tr')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={tid('lang-en')}
          style={[styles.btn, lang === 'en' && styles.btnOn]}
          onPress={() => apply('en')}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, lang === 'en' && styles.btnTextOn]}>{t('lang.en')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  wrapCompact: { alignItems: 'center' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelLight: { color: 'rgba(255,255,255,0.8)' },
  seg: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  segLight: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  btnOn: { backgroundColor: colors.primary },
  btnText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  btnTextOn: { color: colors.white },
});
