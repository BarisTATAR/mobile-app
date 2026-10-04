import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACCOUNT_LANG_MAP_KEY,
  rememberAccountLanguage,
  recallAccountLanguage,
  resolveAccountLanguage,
  attachLanguageToUser,
} from './userLanguageStore';

describe('userLanguageStore', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(ACCOUNT_LANG_MAP_KEY);
  });

  test('remembers English for a username and uses it when the server omits language', async () => {
    await rememberAccountLanguage('Ali', 'en');
    expect(await recallAccountLanguage('ali')).toBe('en');
    expect(await resolveAccountLanguage({ username: 'ali' })).toBe('en');
  });

  test('server language wins over the remembered value', async () => {
    await rememberAccountLanguage('ali', 'en');
    expect(await resolveAccountLanguage({ username: 'ali', serverLanguage: 'tr' })).toBe('tr');
  });

  test('attachLanguageToUser fills missing server language from memory', async () => {
    await rememberAccountLanguage('ali', 'en');
    const user = await attachLanguageToUser({ id: '1', username: 'ali' }, 'ali');
    expect(user.language).toBe('en');
  });
});
