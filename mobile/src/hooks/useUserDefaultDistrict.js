import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api';

const APP_USER_KEY = 'appUser';

export async function loadAppUserProfile() {
  try {
    const raw = await AsyncStorage.getItem(APP_USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.id) return null;
    try {
      const res = await fetch(apiUrl(`/api/user/profile?userId=${encodeURIComponent(user.id)}`));
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user) {
        return { ...user, ...data.user, rememberMe: user.rememberMe };
      }
    } catch {
      /* offline */
    }
    return user;
  } catch {
    return null;
  }
}

/** Giriş yapmış kullanıcının kayıt ilçesini filtreye bir kez uygular (Rezervasyon sayfası gibi). */
export function useUserDefaultDistrict(setDistrict) {
  const [appUser, setAppUser] = useState(null);
  const [districtDefaultReady, setDistrictDefaultReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await loadAppUserProfile();
      if (cancelled) return;
      setAppUser(user);
      const userDistrict = String(user?.address?.district || '').trim();
      if (userDistrict) {
        setDistrict(userDistrict);
      }
      setDistrictDefaultReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [setDistrict]);

  return { appUser, districtDefaultReady };
}
