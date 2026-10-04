import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, useLanguage } from './LanguageContext';

export function pageLanguageKey(page) {
  return `pageLanguage:${page}`;
}

export function usePageLanguage(page, fallbackLang) {
  const { lang: accountLang } = useLanguage();
  const fallback = fallbackLang || accountLang || 'tr';
  const [pageLang, setPageLangState] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(pageLanguageKey(page));
        if (cancelled) return;
        if (raw === 'en' || raw === 'tr') {
          setPageLangState(raw);
          return;
        }
        setPageLangState(fallback === 'en' ? 'en' : 'tr');
      } catch (e) {
        if (!cancelled) setPageLangState(fallback === 'en' ? 'en' : 'tr');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, fallback]);

  const setPageLang = useCallback(async (nextRaw) => {
    const next = nextRaw === 'en' ? 'en' : 'tr';
    setPageLangState(next);
    try {
      await AsyncStorage.setItem(pageLanguageKey(page), next);
    } catch (e) {}
  }, [page]);

  const tx = useCallback((key, params) => translate(pageLang, key, params), [pageLang]);

  return { pageLang, setPageLang, tx };
}
