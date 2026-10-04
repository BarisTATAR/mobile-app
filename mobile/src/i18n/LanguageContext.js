import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import enVerbatim from './enVerbatim';
import { attachLanguageToUser } from './userLanguageStore';

export const LANG_STORAGE_KEY = 'appLanguage';
export const APP_USER_KEY = 'appUser';
export const DEFAULT_LANG = 'tr';

export function normalizeAppLang(raw) {
  return raw === 'en' ? 'en' : 'tr';
}

const nested = {
  tr: {
    login: {
      subtitle: 'Muğla için günlük hizmetler',
      business: 'İşletme',
      user: 'Kullanıcı Girişi',
      signup: 'Kullanıcı Üye Ol',
      guest: 'Üye olmadan devam et',
    },
    tabs: { home: 'Ana Sayfa', profile: 'Profil', logout: 'Çıkış' },
    headers: {
      etkinlikler: 'Yöresel Etkinlikler',
      lisans: 'Lisansı bitmek üzere',
      pending: 'Bekleyen kayıtlar',
    },
    lang: { label: 'Dil', tr: 'TR', en: 'EN' },
    date: { day: 'GG', month: 'AA', year: 'YYYY' },
    weather: {
      unknownCode: 'Kod {code}',
      location: 'Konum: {place}',
      humidity: 'Nem: %{value}',
      wind: 'Rüzgar: {value} km/s',
      unavailable: 'Hava durumu alınamadı.',
      noLocation: 'Konum alınamadı. Konum iznini açın.',
      codes: {
        0: 'Açık',
        1: 'Çoğunlukla açık',
        2: 'Parçalı bulutlu',
        3: 'Bulutlu',
        45: 'Sis',
        48: 'Kırağılı sis',
        51: 'Çisenti (hafif)',
        53: 'Çisenti',
        55: 'Çisenti (yoğun)',
        61: 'Yağmur (hafif)',
        63: 'Yağmur',
        65: 'Yağmur (şiddetli)',
        71: 'Kar (hafif)',
        73: 'Kar',
        75: 'Kar (yoğun)',
        77: 'Kar taneleri',
        80: 'Sağanak (hafif)',
        81: 'Sağanak',
        82: 'Sağanak (şiddetli)',
        85: 'Kar sağanağı (hafif)',
        86: 'Kar sağanağı (şiddetli)',
        95: 'Gök gürültülü fırtına',
        96: 'Gök gürültülü fırtına (dolu)',
      },
    },
    kvkk: {
      p1: '48 App, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca veri sorumlusu sıfatıyla hareket eder.',
      p2: 'Kayıt sırasında verdiğiniz ad, soyad, kullanıcı adı, telefon, doğum tarihi, özel gün ve adres bilgileriniz üyelik hesabınızın oluşturulması, rezervasyon ve yöresel etkinlik taleplerinin iletilmesi, üye numarası ile indirim kontrolü yapılması amacıyla işlenir.',
      p3: 'Cep telefonu numaranız, rezervasyon veya talep oluşturduğunuz işletmelerin sizinle iletişim kurabilmesi ve üyeliğinizin doğrulanması için ilgili işletmelerle paylaşılabilir. Bu paylaşım, verdiğiniz açık rızaya dayanır.',
      p4: 'Konum bilginiz yalnızca siz izin verdiğinizde; nöbetçi eczane, hava durumu ve haritada yakındaki işletmeleri göstermek için kullanılır. Konum zorunlu bir kayıt alanı değildir; ancak bu hizmetler için açık rızanız alınır.',
      p5: 'Verileriniz, yasal saklama süreleri ve hizmetin devamı için gerekli olduğu sürece muhafaza edilir. KVKK kapsamındaki erişim, düzeltme, silme ve rızayı geri çekme talepleriniz için uygulama içinden veya veri sorumlusu ile iletişime geçebilirsiniz. Rızanızı geri çekmeniz, rıza tarihinden sonraki işlemleri etkiler.',
    },
  },
  en: {
    login: {
      subtitle: 'Daily services for Muğla',
      business: 'Business',
      user: 'User login',
      signup: 'Create account',
      guest: 'Continue as guest',
    },
    tabs: { home: 'Home', profile: 'Profile', logout: 'Log out' },
    headers: {
      etkinlikler: 'Local events',
      lisans: 'Licenses expiring soon',
      pending: 'Pending registrations',
    },
    lang: { label: 'Language', tr: 'TR', en: 'EN' },
    date: { day: 'DD', month: 'MM', year: 'YYYY' },
    weather: {
      unknownCode: 'Code {code}',
      location: 'Location: {place}',
      humidity: 'Humidity: {value}%',
      wind: 'Wind: {value} km/h',
      unavailable: 'Could not load the weather.',
      noLocation: 'Could not get location. Turn on location permission.',
      codes: {
        0: 'Clear',
        1: 'Mostly clear',
        2: 'Partly cloudy',
        3: 'Cloudy',
        45: 'Fog',
        48: 'Rime fog',
        51: 'Light drizzle',
        53: 'Drizzle',
        55: 'Dense drizzle',
        61: 'Light rain',
        63: 'Rain',
        65: 'Heavy rain',
        71: 'Light snow',
        73: 'Snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Light showers',
        81: 'Showers',
        82: 'Heavy showers',
        85: 'Light snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
      },
    },
    kvkk: {
      p1: '48 App acts as data controller under Turkey’s Personal Data Protection Law (KVKK / Law No. 6698).',
      p2: 'The name, surname, username, phone, date of birth, special day and address you give at sign-up are used to create your account, send reservation and local-event requests, and check member-number discounts.',
      p3: 'Your mobile number may be shared with businesses you contact so they can reach you and confirm your membership. This sharing is based on your explicit consent.',
      p4: 'Your location is used only if you allow it: duty pharmacies, weather, and nearby businesses on the map. Location is not required to register, but these services need your consent.',
      p5: 'We keep your data for as long as the law and the service require. You can ask to access, correct, delete or withdraw consent in the app or via the data controller. Withdrawing consent applies to processing after that date.',
    },
  },
};

function lookup(dict, key) {
  if (!dict || key == null) return undefined;
  if (dict.verbatim && dict.verbatim[key] != null) return dict.verbatim[key];
  if (typeof key === 'string' && key.includes('.')) {
    const parts = key.split('.');
    let cur = dict;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[p];
    }
    if (typeof cur === 'string') return cur;
  }
  if (typeof dict[key] === 'string') return dict[key];
  return undefined;
}

function interpolate(str, params) {
  if (!params) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
}

export function translate(lang, key, params) {
  const code = lang === 'en' ? 'en' : 'tr';
  const dict = {
    ...nested[code],
    verbatim: code === 'en' ? enVerbatim : undefined,
  };
  let raw = lookup(dict, key);
  if (raw == null && code !== 'tr') raw = lookup({ ...nested.tr }, key);
  if (raw == null) raw = key;
  return interpolate(raw, params);
}

let currentLang = DEFAULT_LANG;
const listeners = new Set();

function setCurrentLang(next) {
  currentLang = next === 'en' ? 'en' : 'tr';
  listeners.forEach((fn) => fn(currentLang));
}

export function getLang() {
  return currentLang;
}

export function txNow(key, params) {
  return translate(currentLang, key, params);
}

const defaultValue = {
  lang: DEFAULT_LANG,
  setLang: async () => {},
  t: (key, params) => translate(DEFAULT_LANG, key, params),
  tx: (key, params) => translate(DEFAULT_LANG, key, params),
};

const LanguageContext = createContext(defaultValue);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem(APP_USER_KEY);
        const user = rawUser ? JSON.parse(rawUser) : null;
        if (cancelled) return;
        if (user?.id) {
          const withLang = await attachLanguageToUser(user, user.username);
          if (cancelled) return;
          await AsyncStorage.setItem(APP_USER_KEY, JSON.stringify(withLang));
          const next = normalizeAppLang(withLang.language);
          setLangState(next);
          setCurrentLang(next);
          return;
        }
        const raw = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        if (cancelled) return;
        const next = normalizeAppLang(raw);
        setLangState(next);
        setCurrentLang(next);
      } catch (e) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback(async (nextRaw) => {
    const next = normalizeAppLang(nextRaw);
    setLangState(next);
    setCurrentLang(next);
    try {
      await AsyncStorage.setItem(LANG_STORAGE_KEY, next);
    } catch (e) {}
  }, []);

  const t = useCallback((key, params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, tx: t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
