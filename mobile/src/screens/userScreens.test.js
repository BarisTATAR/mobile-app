import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import HomeScreen from './HomeScreen';
import SettingsScreen from './SettingsScreen';
import UserLoginScreen from './UserLoginScreen';
import SignUpScreen from './SignUpScreen';
import AdminLoginScreen from './AdminLoginScreen';
import ProfileScreen from './ProfileScreen';
import PharmacyOnDutyScreen from './PharmacyOnDutyScreen';

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
    const { getByTestId, getByText } = render(<LoginScreen navigation={navigation} />);
    expect(getByText('48 App')).toBeTruthy();
    fireEvent.press(getByTestId('login-user'));
    expect(navigation.navigate).toHaveBeenCalledWith('UserLogin');
    fireEvent.press(getByTestId('login-signup'));
    expect(navigation.navigate).toHaveBeenCalledWith('SignUp');
    fireEvent.press(getByTestId('login-guest'));
    expect(navigation.replace).toHaveBeenCalledWith('Main', { screen: 'Home', params: { guest: true } });
    fireEvent.press(getByTestId('login-business'));
    expect(navigation.navigate).toHaveBeenCalledWith('BusinessLogin');
  });
});

describe('HomeScreen', () => {
  test('renders all menu tiles', () => {
    const { getByTestId } = render(<HomeScreen navigation={nav()} route={{ params: {} }} />);
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
});

describe('SettingsScreen', () => {
  test('logout returns to Login', async () => {
    const navigation = nav();
    const { getByTestId } = render(<SettingsScreen navigation={navigation} />);
    fireEvent.press(getByTestId('logout-button'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Login'));
  });
});

describe('UserLoginScreen', () => {
  test('empty submit shows alert', () => {
    const { getByTestId } = render(<UserLoginScreen navigation={nav()} />);
    fireEvent.press(getByTestId('login-submit'));
    expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Kullanıcı adı ve şifre girin.');
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
    const { getByText } = render(<AdminLoginScreen navigation={nav()} />);
    fireEvent.press(getByText('Giriş Yap'));
    expect(Alert.alert).toHaveBeenCalledWith('Hata', 'Kullanıcı adı ve şifre girin');
  });
});

describe('ProfileScreen', () => {
  test('shows logged-out copy', async () => {
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText('Giriş yapılmadı')).toBeTruthy();
  });
});

describe('PharmacyOnDutyScreen', () => {
  test('shows fetch button and title', async () => {
    const { getByText, findByText } = render(<PharmacyOnDutyScreen navigation={nav()} />);
    expect(getByText('Nöbetçi Eczaneler')).toBeTruthy();
    expect(await findByText('Nöbetçi eczaneleri getir')).toBeTruthy();
  });
});
