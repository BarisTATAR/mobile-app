import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeAppLang(raw) {
  return raw === 'en' ? 'en' : 'tr';
}

export const ACCOUNT_LANG_MAP_KEY = 'accountLanguageByUsername';

function usernameKey(username) {
  return String(username || '').trim().toLowerCase();
}

export async function rememberAccountLanguage(username, language) {
  const key = usernameKey(username);
  if (!key) return normalizeAppLang(language);
  const lang = normalizeAppLang(language);
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_LANG_MAP_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[key] = lang;
    await AsyncStorage.setItem(ACCOUNT_LANG_MAP_KEY, JSON.stringify(map));
  } catch (e) {}
  return lang;
}

export async function recallAccountLanguage(username) {
  const key = usernameKey(username);
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_LANG_MAP_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (map[key] === 'en' || map[key] === 'tr') return map[key];
  } catch (e) {}
  return null;
}

export async function resolveAccountLanguage({ username, serverLanguage } = {}) {
  if (serverLanguage === 'en' || serverLanguage === 'tr') {
    return serverLanguage;
  }
  const remembered = await recallAccountLanguage(username);
  return remembered || 'tr';
}

export async function attachLanguageToUser(user, fallbackUsername) {
  const username = user?.username || fallbackUsername;
  const language = await resolveAccountLanguage({
    username,
    serverLanguage: user?.language,
  });
  if (username) await rememberAccountLanguage(username, language);
  return { ...(user || {}), language };
}
