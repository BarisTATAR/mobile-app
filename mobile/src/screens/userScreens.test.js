import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import HomeScreen from './HomeScreen';
import SettingsScreen from './SettingsScreen';
import UserLoginScreen from './UserLoginScreen';
import SignUpScreen from './SignUpScreen';
import AdminLoginScreen from './AdminLoginScreen';
import ProfileScreen from './ProfileScreen';
import PharmacyOnDutyScreen from './PharmacyOnDutyScreen';
import { LanguageProvider, LANG_STORAGE_KEY } from '../i18n/LanguageContext';
import { rememberAccountLanguage } from '../i18n/userLanguageStore';
import { pageLanguageKey } from '../i18n/usePageLanguage';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

jest.mock('../services/turkeyAddressService', () => ({
  DEFAULT_CITY: 'Muğla',
  MUGLA_DISTRICT_NAMES: ['Fethiye', 'Menteşe', 'Bodrum'],
  matchMuglaDistrict: jest.fn((raw) => (raw ? String(raw) : '')),
  matchMuglaDistrictFromFields: jest.fn(() => ''),
  nearestPharmacyDistrict: jest.fn(() => ''),
  nearestDistrictByCoords: jest.fn(() => ''),
  resolveMuglaDistrict: jest.fn(() => ''),
  resolveLocationPlace: jest.fn(() => ({ city: '', district: '' })),
  isLikelyMuglaCoords: jest.fn(() => false),
  filterPharmaciesByDistrict: jest.fn((list, districtName) => {
    if (!districtName) return list || [];
    return (list || []).filter((p) => p.district === districtName);
  }),
  getProvinces: jest.fn(async () => []),
  getDistrictsForProvince: jest.fn(() => []),
  getNeighborhoods: jest.fn(async () => []),
}));

jest.mock('../services/locationService', () => ({
  getLocationWithCityDistrict: jest.fn(async () => null),
}));

jest.mock('../hooks/useUserDefaultDistrict', () => ({
  useUserDefaultDistrict: () => ({ appUser: null, districtDefaultReady: true }),
}));

const nav = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
});

describe('LoginScreen', () => {
  test('shows main entry buttons and navigates', () => {
    const navigation = nav();
    const { getByTestId, getByText, queryByTestId } = render(<LoginScreen navigation={navigation} />);
    expect(getByText('48 App')).toBeTruthy();
    expect(queryByTestId('lang-tr')).toBeNull();
    expect(queryByTestId('lang-en')).toBeNull();
    expect(getByTestId('cover-lang-tr')).toBeTruthy();
    expect(getByTestId('cover-lang-en')).toBeTruthy();
    fireEvent.press(getByTestId('login-user'));
    expect(navigation.navigate).toHaveBeenCalledWith('UserLogin');
    fireEvent.press(getByTestId('login-signup'));
    expect(navigation.navigate).toHaveBeenCalledWith('SignUp');
    fireEvent.press(getByTestId('login-guest'));
    expect(navigation.replace).toHaveBeenCalledWith('Main', { screen: 'Home', params: { guest: true } });
    fireEvent.press(getByTestId('login-business'));
    expect(navigation.navigate).toHaveBeenCalledWith('BusinessLogin');
  });

  test('cover language switcher translates only the cover page', async () => {
    await AsyncStorage.removeItem(pageLanguageKey('cover'));
    const { getByTestId, findByText, queryByText } = render(
      <LanguageProvider>
        <LoginScreen navigation={nav()} />
      </LanguageProvider>
    );
    expect(await findByText('Kullanıcı Girişi')).toBeTruthy();
    fireEvent.press(getByTestId('cover-lang-en'));
    expect(await findByText('User login')).toBeTruthy();
    expect(queryByText('Kullanıcı Girişi')).toBeNull();
    expect(await AsyncStorage.getItem(LANG_STORAGE_KEY)).not.toBe('en');
    await AsyncStorage.removeItem(pageLanguageKey('cover'));
  });
});

describe('HomeScreen', () => {
  test('renders all menu tiles', () => {
    const { getByTestId, queryByTestId } = render(<HomeScreen navigation={nav()} route={{ params: {} }} />);
    expect(queryByTestId('home-lang-tr')).toBeNull();
    expect(queryByTestId('home-lang-en')).toBeNull();
    ['duyurular', 'rezervasyon', 'etkinlikler', 'esnaf', 'hava', 'eczane', 'cekici', 'lastikci', 'taksi', 'isilanlari', 'kampanyalar']
      .forEach((id) => expect(getByTestId(`home-card-${id}`)).toBeTruthy());
  });

  test('guest cannot open reservation without login warning', () => {
    const navigation = nav();
    const { getByTestId } = render(
      <HomeScreen navigation={navigation} route={{ params: { guest: true } }} />
    );
    fireEvent.press(getByTestId('home-card-rezervasyon'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Üye girişi gerekli',
      expect.any(String),
      expect.any(Array)
    );
    expect(navigation.navigate).not.toHaveBeenCalledWith('BusinessList');
  });

  test('member opens reservation list', () => {
    const navigation = nav();
    const { getByTestId } = render(<HomeScreen navigation={navigation} route={{ params: {} }} />);
    fireEvent.press(getByTestId('home-card-rezervasyon'));
    expect(navigation.navigate).toHaveBeenCalledWith('BusinessList');
  });

  test('member opens local events in Turkish', () => {
    const navigation = nav();
    const { getByTestId } = render(<HomeScreen navigation={navigation} route={{ params: {} }} />);
    fireEvent.press(getByTestId('home-card-etkinlikler'));
    expect(navigation.navigate).toHaveBeenCalledWith('Etkinlikler');
  });

  test('English language disables local events', async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, 'en');
    const navigation = nav();
    const { getByTestId, findByText } = render(
      <LanguageProvider>
        <HomeScreen navigation={navigation} route={{ params: {} }} />
      </LanguageProvider>
    );
    expect(await findByText('Local events')).toBeTruthy();
    fireEvent.press(getByTestId('home-card-etkinlikler'));
    expect(navigation.navigate).not.toHaveBeenCalledWith('Etkinlikler');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Local events',
      'Local events are only available in Turkish.'
    );
    await AsyncStorage.removeItem(LANG_STORAGE_KEY);
  });
});

describe('SettingsScreen', () => {
  test('logout returns to Login', async () => {
    const navigation = nav();
    const { getByTestId, queryByTestId } = render(<SettingsScreen navigation={navigation} />);
    expect(queryByTestId('lang-tr')).toBeNull();
    expect(queryByTestId('lang-en')).toBeNull();
    fireEvent.press(getByTestId('logout-button'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Login'));
  });
});

describe('UserLoginScreen', () => {
  test('empty submit shows alert', () => {
    const { getByTestId } = render(<UserLoginScreen navigation={nav()} />);
    expect(getByTestId('user-login-lang-tr')).toBeTruthy();
    expect(getByTestId('user-login-lang-en')).toBeTruthy();
    expect(getByTestId('login-back')).toBeTruthy();
    fireEvent.press(getByTestId('login-submit'));
    expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Kullanıcı adı ve şifre girin.');
  });

  test('back button stays in the top bar', () => {
    const navigation = nav();
    const { getByTestId } = render(<UserLoginScreen navigation={navigation} />);
    fireEvent.press(getByTestId('login-back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('user login language switcher translates only that page', async () => {
    await AsyncStorage.removeItem(pageLanguageKey('userLogin'));
    const { getByTestId, findByText, queryByText } = render(
      <LanguageProvider>
        <UserLoginScreen navigation={nav()} />
      </LanguageProvider>
    );
    expect(await findByText('Kullanıcı Girişi')).toBeTruthy();
    fireEvent.press(getByTestId('user-login-lang-en'));
    expect(await findByText('User login')).toBeTruthy();
    expect(queryByText('Kullanıcı Girişi')).toBeNull();
    expect(await AsyncStorage.getItem(LANG_STORAGE_KEY)).not.toBe('en');
    await AsyncStorage.removeItem(pageLanguageKey('userLogin'));
  });

  test('applies remembered English after login even if server omits language', async () => {
    await rememberAccountLanguage('ali', 'en');
    global.fetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, user: { id: 'u1', username: 'ali', name: 'Ali' } }),
    }));
    const navigation = nav();
    const { getByTestId, getByPlaceholderText } = render(
      <LanguageProvider>
        <UserLoginScreen navigation={navigation} />
      </LanguageProvider>
    );
    fireEvent.changeText(getByPlaceholderText('Kullanıcı adınızı girin'), 'ali');
    fireEvent.changeText(getByPlaceholderText('Şifrenizi girin'), '123456');
    fireEvent.press(getByTestId('login-submit'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Main'));
    const raw = await AsyncStorage.getItem('appUser');
    expect(JSON.parse(raw).language).toBe('en');
    await AsyncStorage.removeItem('appUser');
    await AsyncStorage.removeItem(LANG_STORAGE_KEY);
    global.fetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
  });
});

describe('SignUpScreen', () => {
  test('shows required fields and KVKK block; submit disabled without consent', async () => {
    const { getByText, getAllByText, getAllByPlaceholderText, getByTestId } = render(
      <SignUpScreen navigation={nav()} />
    );
    expect(getAllByPlaceholderText('GG').length).toBeGreaterThanOrEqual(1);
    expect(getAllByPlaceholderText('AA').length).toBeGreaterThanOrEqual(1);
    expect(getAllByPlaceholderText('YYYY').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('lang-tr')).toBeTruthy();
    expect(getByTestId('lang-en')).toBeTruthy();
    expect(getByText('Kayıt olduktan sonra dil değiştirilemez.')).toBeTruthy();
    expect(getByText('KVKK Aydınlatma ve Açık Rıza')).toBeTruthy();
    expect(getAllByText('Kayıt Ol').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('signup-submit').props.accessibilityState.disabled).toBe(true);
    await waitFor(() => expect(getByText('KVKK Aydınlatma ve Açık Rıza')).toBeTruthy());
  });

  test('inserts slashes while typing birth date', () => {
    const { getByTestId } = render(<SignUpScreen navigation={nav()} />);
    fireEvent.changeText(getByTestId('signup-birth-date-day'), '23');
    fireEvent.changeText(getByTestId('signup-birth-date-month'), '09');
    fireEvent.changeText(getByTestId('signup-birth-date-year'), '1990');
    expect(getByTestId('signup-birth-date-day').props.value).toBe('23');
    expect(getByTestId('signup-birth-date-month').props.value).toBe('09');
    expect(getByTestId('signup-birth-date-year').props.value).toBe('1990');
  });

  test('password mismatch disables submit', () => {
    const { getByTestId } = render(<SignUpScreen navigation={nav()} />);
    fireEvent.changeText(getByTestId('signup-password'), '123456');
    fireEvent.changeText(getByTestId('signup-password-repeat'), '123457');
    expect(getByTestId('signup-submit').props.accessibilityState.disabled).toBe(true);
  });
});

describe('AdminLoginScreen', () => {
  test('empty fields alert', () => {
    const navigation = nav();
    const { getByText, getByTestId } = render(<AdminLoginScreen navigation={navigation} />);
    expect(getByTestId('admin-login-back')).toBeTruthy();
    fireEvent.press(getByText('Giriş Yap'));
    expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Kullanıcı adı ve şifre girin');
    fireEvent.press(getByTestId('admin-login-back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('ProfileScreen', () => {
  test('shows logged-out copy', async () => {
    await AsyncStorage.removeItem('appUser');
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText('Giriş yapılmadı')).toBeTruthy();
  });

  test('follows opening language', async () => {
    await AsyncStorage.removeItem('appUser');
    await AsyncStorage.setItem(LANG_STORAGE_KEY, 'en');
    const { findByText } = render(
      <LanguageProvider>
        <ProfileScreen />
      </LanguageProvider>
    );
    expect(await findByText('Not signed in')).toBeTruthy();
    expect(await findByText('My member number')).toBeTruthy();
    expect(await findByText('My details')).toBeTruthy();
    await AsyncStorage.removeItem(LANG_STORAGE_KEY);
  });
});

describe('PharmacyOnDutyScreen', () => {
  test('shows fetch button and title', async () => {
    const { getByText, findByText } = render(<PharmacyOnDutyScreen navigation={nav()} />);
    expect(getByText('Nöbetçi Eczaneler')).toBeTruthy();
    expect(await findByText('Nöbetçi eczaneleri getir')).toBeTruthy();
  });
});
