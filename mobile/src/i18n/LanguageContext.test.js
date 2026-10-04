import { translate, normalizeAppLang } from './LanguageContext';

describe('translate', () => {
  test('normalizes account language to tr or en', () => {
    expect(normalizeAppLang('en')).toBe('en');
    expect(normalizeAppLang('tr')).toBe('tr');
    expect(normalizeAppLang('de')).toBe('tr');
  });

  test('defaults Turkish strings stay Turkish', () => {
    expect(translate('tr', 'Kullanıcı Girişi')).toBe('Kullanıcı Girişi');
    expect(translate('tr', 'login.user')).toBe('Kullanıcı Girişi');
  });

  test('English maps known UI copy', () => {
    expect(translate('en', 'login.user')).toBe('User login');
    expect(translate('en', 'Kullanıcı Girişi')).toBe('User login');
    expect(translate('en', 'Talep gönder')).toBe('Send request');
  });

  test('nearby sort and list filters map to English', () => {
    expect(translate('en', 'Yakından uzağa göster')).toBe('Show nearest first');
    expect(translate('en', 'Tümü')).toBe('All');
    expect(translate('en', 'Restoran')).toBe('Restaurant');
    expect(translate('en', '{place}: {count} kayıt', { place: 'All districts', count: 3 })).toBe(
      'All districts: 3 listings'
    );
  });

  test('weather codes stay Clear in English and do not use Open', () => {
    expect(translate('tr', 'weather.codes.0')).toBe('Açık');
    expect(translate('en', 'weather.codes.0')).toBe('Clear');
    expect(translate('en', 'Açık')).toBe('Open');
    expect(translate('en', 'weather.humidity', { value: 40 })).toBe('Humidity: 40%');
  });
});
