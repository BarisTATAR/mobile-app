import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent } from '@testing-library/react-native';
import EsnafListScreen from './EsnafListScreen';
import CekiciListScreen from './CekiciListScreen';
import LastikciListScreen from './LastikciListScreen';
import TaksiListScreen from './TaksiListScreen';
import DuyurularListScreen from './DuyurularListScreen';
import IsIlanlariListScreen from './IsIlanlariListScreen';
import BusinessListScreen from './BusinessListScreen';
import EtkinliklerScreen from './EtkinliklerScreen';
import WeatherScreen from './WeatherScreen';
import NearbySortButton from '../components/NearbySortButton';
import { LanguageProvider, LANG_STORAGE_KEY } from '../i18n/LanguageContext';
import { getCurrentPosition, reverseGeocode } from '../services/locationService';

jest.mock('../services/turkeyAddressService', () => ({
  DEFAULT_CITY: 'Muğla',
  getProvinces: jest.fn(async () => []),
  getDistrictsForProvince: jest.fn(() => []),
  getNeighborhoods: jest.fn(async () => []),
}));

jest.mock('../hooks/useUserDefaultDistrict', () => ({
  useUserDefaultDistrict: () => ({ appUser: null, districtDefaultReady: true }),
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const nav = () => ({ navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() });

describe('list and content screens', () => {
  test('Esnaf shows title and list button', () => {
    const { getByText } = render(<EsnafListScreen navigation={nav()} />);
    expect(getByText('Esnaf')).toBeTruthy();
    expect(getByText('Listele')).toBeTruthy();
    expect(getByText('Liste')).toBeTruthy();
    expect(getByText('Harita')).toBeTruthy();
  });

  test('Çekici / Lastikçim / Taksi titles', () => {
    expect(render(<CekiciListScreen navigation={nav()} />).getByText('Çekici')).toBeTruthy();
    expect(render(<LastikciListScreen navigation={nav()} />).getByText('Lastikçim')).toBeTruthy();
    expect(render(<TaksiListScreen navigation={nav()} />).getByText('Taksi')).toBeTruthy();
  });

  test('Duyurular and kampanya titles', () => {
    expect(render(<DuyurularListScreen navigation={nav()} route={{ params: {} }} />).getByText('Duyurular')).toBeTruthy();
    expect(
      render(<DuyurularListScreen navigation={nav()} route={{ params: { mode: 'kampanya' } }} />).getByText(
        'Kampanyalar/İndirimler'
      )
    ).toBeTruthy();
  });

  test('İş ilanları title', () => {
    expect(render(<IsIlanlariListScreen navigation={nav()} />).getByText('İş ilanları')).toBeTruthy();
  });

  test('Rezervasyon list title', () => {
    expect(render(<BusinessListScreen navigation={nav()} />).getByText('Rezervasyon')).toBeTruthy();
  });

  test('English translates list descriptions, filters and nearby sort', async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, 'en');
    const { findByText } = render(
      <LanguageProvider>
        <BusinessListScreen navigation={nav()} />
      </LanguageProvider>
    );
    expect(await findByText('Reservations')).toBeTruthy();
    expect(
      await findByText(
        'Filter by district and neighborhood; tap a card to pick date/time and send a request. Scroll the list to move the filters up.'
      )
    ).toBeTruthy();
    expect(await findByText('Filter (swipe up)')).toBeTruthy();
    expect(await findByText('Activity type')).toBeTruthy();
    const nearby = render(
      <LanguageProvider>
        <NearbySortButton active={false} loading={false} onPress={() => {}} />
      </LanguageProvider>
    );
    expect(await nearby.findByText('Show nearest first')).toBeTruthy();
    await AsyncStorage.removeItem(LANG_STORAGE_KEY);
  });

  test('guest cannot open reservation form', async () => {
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/businesses')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            businesses: [{ _id: 'b1', businessName: 'Test Restoran', activityField: 'restorant', address: {} }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const { findByText } = render(<BusinessListScreen navigation={nav()} />);
    fireEvent.press(await findByText('Test Restoran'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Üye girişi gerekli',
      'Rezervasyon yapmak için üye olmalısınız.',
      expect.any(Array)
    );
    global.fetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
  });

  test('Yöresel etkinlik types', () => {
    const { getByText, queryByText } = render(<EtkinliklerScreen navigation={nav()} />);
    expect(getByText('Yöresel Etkinlikler')).toBeTruthy();
    expect(getByText('Düğün')).toBeTruthy();
    expect(getByText('Giriş yap / Üye ol')).toBeTruthy();
    expect(queryByText('Talep gönder')).toBeNull();
  });

  test('member cannot send yoresel request without a service', async () => {
    await AsyncStorage.setItem(
      'appUser',
      JSON.stringify({ id: 'u1', name: 'Ali', surname: 'Yılmaz', username: 'ali' })
    );
    const { findByText } = render(<EtkinliklerScreen navigation={nav()} />);
    fireEvent.press(await findByText('Talep gönder'));
    expect(Alert.alert).toHaveBeenCalledWith('Uyarı', 'En az bir hizmet alanı seçin.');
    await AsyncStorage.removeItem('appUser');
  });

  test('member sees pay button when reservation fee is required', async () => {
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/payments/yoresel/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fee: 150,
            required: true,
            paid: false,
            paymentConfigured: true,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    await AsyncStorage.setItem(
      'appUser',
      JSON.stringify({ id: 'u1', name: 'Ali', surname: 'Yılmaz', username: 'ali' })
    );
    const { findByTestId, getByText } = render(<EtkinliklerScreen navigation={nav()} />);
    expect(await findByTestId('yoresel-pay-button')).toBeTruthy();
    expect(getByText('Rezervasyon bedeli')).toBeTruthy();
    const submit = await findByTestId('yoresel-submit-button');
    expect(submit.props.accessibilityState?.disabled || submit.props.disabled).toBe(true);
    await AsyncStorage.removeItem('appUser');
    global.fetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
  });

  test('Hava durumu title', async () => {
    const { getAllByText } = render(<WeatherScreen navigation={nav()} />);
    expect(getAllByText('Hava Durumu').length).toBeGreaterThanOrEqual(1);
  });

  test('English weather uses English condition copy', async () => {
    await AsyncStorage.setItem(LANG_STORAGE_KEY, 'en');
    getCurrentPosition.mockResolvedValueOnce({ latitude: 37.0, longitude: 28.4 });
    reverseGeocode.mockResolvedValueOnce({ district: 'Fethiye', neighbourhood: '' });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 22,
          relative_humidity_2m: 40,
          weather_code: 0,
          wind_speed_10m: 12,
        },
        hourly: { time: [], temperature_2m: [], weather_code: [] },
        daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [] },
      }),
    });
    const { findByText, queryByText } = render(
      <LanguageProvider>
        <WeatherScreen navigation={nav()} />
      </LanguageProvider>
    );
    expect(await findByText('Weather')).toBeTruthy();
    expect(await findByText('Clear')).toBeTruthy();
    expect(await findByText('Humidity: 40%')).toBeTruthy();
    expect(await findByText('Wind: 12 km/h')).toBeTruthy();
    expect(await findByText('Location: Fethiye')).toBeTruthy();
    expect(queryByText('Açık')).toBeNull();
    expect(queryByText(/Nem:/)).toBeNull();
    await AsyncStorage.removeItem(LANG_STORAGE_KEY);
  });
});
