import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import {
  formatListingOpeningHoursSummary,
  formatBusinessListHoursSummary,
} from '../utils/openingHoursDisplay';

export default function ListingHoursMenu({ item, textStyle, hoursStyle }) {
  const { tx } = useLanguage();
  const hoursText = item?.activityField
    ? formatBusinessListHoursSummary(item)
    : formatListingOpeningHoursSummary(item);
  if (!hoursText) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hours, hoursStyle, textStyle]}>{hoursText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  hours: { fontSize: 13, color: '#555', lineHeight: 18 },
});
