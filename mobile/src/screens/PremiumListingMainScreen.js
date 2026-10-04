import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PremiumListingsPanel from '../components/PremiumListingsPanel';
import { PREMIUM_LISTING_SESSION_KEY } from './PremiumListingLoginScreen';
import { useLanguage } from '../i18n/LanguageContext';


export default function PremiumListingMainScreen({ route, navigation }) {
  const { tx } = useLanguage();
  const {
    ownerType,
    ownerId,
    loginKey,
    displayName = '',
    registeredDistrict = '',
  } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{displayName || 'Premium Panel'}</Text>
        <TouchableOpacity
          onPress={async () => {
            try {
              await AsyncStorage.removeItem(PREMIUM_LISTING_SESSION_KEY);
            } catch (e) {}
            navigation.replace('Login');
          }}
        >
          <Text style={styles.logout}>{tx('Çıkış')}</Text>
        </TouchableOpacity>
      </View>
      <PremiumListingsPanel
        ownerType={ownerType}
        ownerId={ownerId}
        loginKey={loginKey}
        displayName={displayName}
        registeredDistrict={registeredDistrict}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: '#222', marginRight: 12 },
  logout: { color: '#c00', fontSize: 15 },
});
