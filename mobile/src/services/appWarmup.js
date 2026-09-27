import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';
import { prefetchProvinces } from './turkeyAddressService';
import { HOME_IMAGE_CACHE_KEY } from './cacheKeys';

export { HOME_IMAGE_CACHE_KEY };

let warmupStarted = false;

async function prefetchHomeImage() {
  try {
    const res = await fetch(apiUrl('/api/app-settings'));
    const data = await res.json().catch(() => ({}));
    const url = data.homeImageUrl || '';
    if (url) {
      await AsyncStorage.setItem(HOME_IMAGE_CACHE_KEY, url);
    }
    return url;
  } catch {
    return '';
  }
}

async function pingApi() {
  try {
    await fetch(apiUrl('/api/health'));
  } catch {
    // Render uyandırma; hata yutulur
  }
}

/** Ağ ve adres listesini ekran çizildikten sonra arka planda ısıtır. Harita yüklemez. */
export function warmupAfterFirstPaint() {
  if (warmupStarted) return;
  warmupStarted = true;
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      pingApi()
        .then(() => Promise.all([prefetchHomeImage(), prefetchProvinces()]))
        .catch(() => {});
    }, 250);
  });
}
