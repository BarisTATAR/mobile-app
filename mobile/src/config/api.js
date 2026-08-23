// API Configuration
// Emulator: Android 10.0.2.2, iOS simulator 127.0.0.1.
// Fiziksel cihaz / Expo Go: Metro'nun IP'si otomatik kullanılır (debuggerHost).
// Elle sabitlemek için PHYSICAL_DEVICE_IP doldurun.
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PHYSICAL_DEVICE_IP = '';
const PORT = 3000;

function getExpoPackagerHost() {
  const hostUri =
    Constants.expoConfig?.hostUri
    || Constants.manifest2?.extra?.expoGo?.debuggerHost
    || Constants.manifest?.debuggerHost
    || Constants.linkingUri;
  if (!hostUri || typeof hostUri !== 'string') return null;
  const withoutProtocol = hostUri.replace(/^[a-z]+:\/\//i, '');
  const host = withoutProtocol.split(':')[0]?.trim();
  return host || null;
}

function isEmulator() {
  return Constants.isDevice === false;
}

function resolveDevApiBaseUrl() {
  if (PHYSICAL_DEVICE_IP) {
    return `http://${PHYSICAL_DEVICE_IP}:${PORT}`;
  }

  const packagerHost = getExpoPackagerHost();
  const packagerLan = packagerHost
    && packagerHost !== 'localhost'
    && packagerHost !== '127.0.0.1';

  // iOS simülatör: Metro LAN IP üzerindeyse backend'e de oradan git (127.0.0.1 bazen bağlanmaz)
  if (Platform.OS === 'ios' && isEmulator()) {
    if (packagerLan) return `http://${packagerHost}:${PORT}`;
    return `http://127.0.0.1:${PORT}`;
  }

  if (Platform.OS === 'android' && isEmulator()) {
    return `http://10.0.2.2:${PORT}`;
  }

  if (packagerLan) {
    return `http://${packagerHost}:${PORT}`;
  }

  if (packagerHost) {
    const host = packagerHost === 'localhost' ? '127.0.0.1' : packagerHost;
    return `http://${host}:${PORT}`;
  }

  return Platform.OS === 'android' ? `http://10.0.2.2:${PORT}` : `http://127.0.0.1:${PORT}`;
}

function getDevApiBaseUrlCandidates() {
  const seen = new Set();
  const out = [];
  const add = (url) => {
    const u = (url || '').replace(/\/$/, '');
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };

  add(resolveDevApiBaseUrl());

  const packager = getExpoPackagerHost();
  if (packager && packager !== 'localhost' && packager !== '127.0.0.1') {
    add(`http://${packager}:${PORT}`);
  }

  if (Platform.OS === 'ios' && isEmulator()) {
    add(`http://127.0.0.1:${PORT}`);
    add(`http://localhost:${PORT}`);
  }
  if (Platform.OS === 'android' && isEmulator()) {
    add(`http://10.0.2.2:${PORT}`);
  }

  add(`http://127.0.0.1:${PORT}`);
  return out;
}

const API_BASE_URL = __DEV__ ? resolveDevApiBaseUrl() : 'https://your-production-api.com';

const getBaseUrl = () => (API_BASE_URL || '').replace(/\/$/, '');

if (__DEV__ && typeof console !== 'undefined') {
  console.log('[API] Backend URL:', API_BASE_URL || 'tanımsız');
  const packager = getExpoPackagerHost();
  if (packager) console.log('[API] Expo packager host:', packager);
  console.log('[API] Cihaz:', Constants.isDevice ? 'fiziksel' : 'simülatör/emülatör');
}

export { API_BASE_URL };
export function apiUrl(path) {
  const base = getBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(path, init = {}) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const bases = __DEV__ ? getDevApiBaseUrlCandidates() : [getBaseUrl()];
  let lastError = null;
  for (const base of bases) {
    try {
      const res = await fetch(`${base}${p}`, init);
      if (__DEV__ && base !== getBaseUrl()) {
        console.log('[API] Bağlantı adresi:', base);
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Network request failed');
}
