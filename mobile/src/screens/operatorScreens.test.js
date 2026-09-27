import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import BusinessLoginScreen from './BusinessLoginScreen';
import YoreselBusinessLoginScreen from './YoreselBusinessLoginScreen';
import PremiumListingLoginScreen from './PremiumListingLoginScreen';
import ViewModeToggle from '../components/ViewModeToggle';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const nav = () => ({ navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() });

describe('BusinessLoginScreen', () => {
  test('shows operator types and empty login alert', () => {
    const { getByText } = render(<BusinessLoginScreen navigation={nav()} />);
    expect(getByText('Rezervasyon işletmesi')).toBeTruthy();
    expect(getByText('Esnaf')).toBeTruthy();
    fireEvent.press(getByText('Giriş Yap'));
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('YoreselBusinessLoginScreen', () => {
  test('empty login alert', () => {
    const { getByText } = render(<YoreselBusinessLoginScreen navigation={nav()} />);
    fireEvent.press(getByText('Giriş Yap'));
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('PremiumListingLoginScreen', () => {
  test('empty login alert', () => {
    const { getByText } = render(<PremiumListingLoginScreen navigation={nav()} />);
    fireEvent.press(getByText('Giriş Yap'));
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('ViewModeToggle', () => {
  test('switches list and map', () => {
    const onChange = jest.fn();
    const { getByText } = render(<ViewModeToggle viewMode="list" onChange={onChange} />);
    fireEvent.press(getByText('Harita'));
    expect(onChange).toHaveBeenCalledWith('map');
  });
});
