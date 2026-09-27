import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import BusinessSignUpScreen from './BusinessSignUpScreen';
import AdminSignUpScreen from './AdminSignUpScreen';
import BusinessMainScreen from './BusinessMainScreen';
import YoreselBusinessMainScreen from './YoreselBusinessMainScreen';
import PremiumListingMainScreen from './PremiumListingMainScreen';
import LisansBitmekUzereScreen from './LisansBitmekUzereScreen';
import BekleyenKayitlarScreen from './BekleyenKayitlarScreen';
import AdminUsersByAddressScreen from './AdminUsersByAddressScreen';
import AdminUsersScreen from './AdminUsersScreen';
import AdminMainScreen from './AdminMainScreen';

const nav = () => ({ navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() });

describe('operator and admin panels (smoke)', () => {
  test('İşletme Kayıt title', async () => {
    const { getByText } = render(<BusinessSignUpScreen navigation={nav()} />);
    expect(getByText('İşletme Kayıt')).toBeTruthy();
    await waitFor(() => expect(getByText('İşletme Kayıt')).toBeTruthy());
  });

  test('Admin Kayıt title', () => {
    expect(render(<AdminSignUpScreen navigation={nav()} />).getByText('Admin Kayıt')).toBeTruthy();
  });

  test('Admin panel buttons', () => {
    const { getByText } = render(<AdminMainScreen navigation={nav()} />);
    expect(getByText('Admin Panel')).toBeTruthy();
    expect(getByText('Kullanıcılar')).toBeTruthy();
    expect(getByText('Bekleyen kayıtlar')).toBeTruthy();
  });

  test('Business main header', () => {
    expect(render(<BusinessMainScreen navigation={nav()} route={{ params: {} }} />).getByText('48 App')).toBeTruthy();
  });

  test('Yöresel panel header', () => {
    expect(
      render(<YoreselBusinessMainScreen navigation={nav()} route={{ params: {} }} />).getByText('Yöresel İşletme')
    ).toBeTruthy();
  });

  test('Premium panel header', () => {
    expect(
      render(<PremiumListingMainScreen navigation={nav()} route={{ params: {} }} />).getByText('Premium Panel')
    ).toBeTruthy();
  });

  test('Lisans bitmek üzere title', async () => {
    const { findByText } = render(<LisansBitmekUzereScreen navigation={nav()} />);
    expect(await findByText('Lisansı bitmek üzere')).toBeTruthy();
  });

  test('Bekleyen kayıtlar loads then shows copy', async () => {
    const { findByText } = render(<BekleyenKayitlarScreen navigation={nav()} />);
    expect(await findByText(/İşletme kayıt ol/)).toBeTruthy();
  });

  test('Admin users by address toolbar', async () => {
    const { findByText } = render(<AdminUsersByAddressScreen navigation={nav()} />);
    expect(await findByText('Kullanıcı adresleri')).toBeTruthy();
  });

  test('Admin users toolbar', async () => {
    const { findByText } = render(<AdminUsersScreen navigation={nav()} />);
    expect(await findByText('Kullanıcılar')).toBeTruthy();
  });
});
