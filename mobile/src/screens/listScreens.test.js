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

  test('Hava durumu title', async () => {
    const { getAllByText } = render(<WeatherScreen navigation={nav()} />);
    expect(getAllByText('Hava Durumu').length).toBeGreaterThanOrEqual(1);
  });
});
