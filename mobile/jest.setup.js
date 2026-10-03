jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('./src/services/appWarmup', () => ({
  warmupAfterFirstPaint: jest.fn(),
}));

jest.mock('./src/config/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  apiUrl: (path) => `http://localhost:3000${path}`,
  apiFetch: jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })),
}));

jest.mock('./src/services/locationService', () => ({
  getLocationWithCityDistrict: jest.fn(async () => null),
  getCurrentPosition: jest.fn(async () => null),
  reverseGeocode: jest.fn(async () => null),
}));

jest.mock('./src/services/turkeyAddressService', () => {
  const actual = jest.requireActual('./src/services/turkeyAddressService');
  return {
    ...actual,
    getProvinces: jest.fn(async () => []),
    getDistrictsForProvince: jest.fn(() => []),
    getNeighborhoods: jest.fn(async () => []),
  };
});

jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: (cb) => {
    if (typeof cb === 'function') cb();
    return { cancel: () => {} };
  },
  createInteractionHandle: () => 1,
  clearInteractionHandle: () => {},
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props) => React.createElement(View, props) };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = (props) => React.createElement(View, props, props.children);
  Mock.Marker = Mock;
  return { __esModule: true, default: Mock, Marker: Mock, PROVIDER_DEFAULT: 'google' };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '{}',
}));

const originalError = console.error;
console.error = (...args) => {
  const msg = String(args[0] || '');
  if (msg.includes('not wrapped in act(')) return;
  originalError(...args);
};
