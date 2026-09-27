import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function lazyScreen(loader) {
  let Screen;
  function LazyScreen(props) {
    if (!Screen) Screen = loader().default;
    return <Screen {...props} />;
  }
  return LazyScreen;
}

const UserLoginScreen = lazyScreen(() => require('./src/screens/UserLoginScreen'));
const HomeScreen = lazyScreen(() => require('./src/screens/HomeScreen'));
const SettingsScreen = lazyScreen(() => require('./src/screens/SettingsScreen'));
const SignUpScreen = lazyScreen(() => require('./src/screens/SignUpScreen'));
const BusinessLoginScreen = lazyScreen(() => require('./src/screens/BusinessLoginScreen'));
const AdminLoginScreen = lazyScreen(() => require('./src/screens/AdminLoginScreen'));
const AdminSignUpScreen = lazyScreen(() => require('./src/screens/AdminSignUpScreen'));
const BusinessSignUpScreen = lazyScreen(() => require('./src/screens/BusinessSignUpScreen'));
const ProfileScreen = lazyScreen(() => require('./src/screens/ProfileScreen'));
const BusinessMainScreen = lazyScreen(() => require('./src/screens/BusinessMainScreen'));
const YoreselBusinessLoginScreen = lazyScreen(() => require('./src/screens/YoreselBusinessLoginScreen'));
const YoreselBusinessMainScreen = lazyScreen(() => require('./src/screens/YoreselBusinessMainScreen'));
const PremiumListingLoginScreen = lazyScreen(() => require('./src/screens/PremiumListingLoginScreen'));
const PremiumListingMainScreen = lazyScreen(() => require('./src/screens/PremiumListingMainScreen'));
const AdminMainScreen = lazyScreen(() => require('./src/screens/AdminMainScreen'));
const AdminUsersScreen = lazyScreen(() => require('./src/screens/AdminUsersScreen'));
const AdminUsersByAddressScreen = lazyScreen(() => require('./src/screens/AdminUsersByAddressScreen'));
const LisansBitmekUzereScreen = lazyScreen(() => require('./src/screens/LisansBitmekUzereScreen'));
const BekleyenKayitlarScreen = lazyScreen(() => require('./src/screens/BekleyenKayitlarScreen'));
const BusinessListScreen = lazyScreen(() => require('./src/screens/BusinessListScreen'));
const EsnafListScreen = lazyScreen(() => require('./src/screens/EsnafListScreen'));
const CekiciListScreen = lazyScreen(() => require('./src/screens/CekiciListScreen'));
const LastikciListScreen = lazyScreen(() => require('./src/screens/LastikciListScreen'));
const DuyurularListScreen = lazyScreen(() => require('./src/screens/DuyurularListScreen'));
const IsIlanlariListScreen = lazyScreen(() => require('./src/screens/IsIlanlariListScreen'));
const TaksiListScreen = lazyScreen(() => require('./src/screens/TaksiListScreen'));
const PharmacyOnDutyScreen = lazyScreen(() => require('./src/screens/PharmacyOnDutyScreen'));
const WeatherScreen = lazyScreen(() => require('./src/screens/WeatherScreen'));
const EtkinliklerScreen = lazyScreen(() => require('./src/screens/EtkinliklerScreen'));

function TabNavigator() {
  return (
    <Tab.Navigator
      lazy
      screenOptions={{
        tabBarActiveTintColor: '#34C759',
        tabBarInactiveTintColor: '#8E8E93',
        freezeOnBlur: true,
        headerStyle: {
          backgroundColor: '#34C759',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          headerTitle: 'Home',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          headerTitle: 'Profile',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Çıkış',
          headerTitle: 'Çıkış',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="BusinessLogin" component={BusinessLoginScreen} />
        <Stack.Screen name="UserLogin" component={UserLoginScreen} />
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="AdminSignUp" component={AdminSignUpScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="BusinessSignUp" component={BusinessSignUpScreen} />
        <Stack.Screen name="BusinessMain" component={BusinessMainScreen} />
        <Stack.Screen name="YoreselBusinessLogin" component={YoreselBusinessLoginScreen} />
        <Stack.Screen name="YoreselBusinessMain" component={YoreselBusinessMainScreen} />
        <Stack.Screen name="PremiumListingLogin" component={PremiumListingLoginScreen} />
        <Stack.Screen name="PremiumListingMain" component={PremiumListingMainScreen} />
        <Stack.Screen name="AdminMain" component={AdminMainScreen} />
        <Stack.Screen name="LisansBitmekUzere" component={LisansBitmekUzereScreen} options={{ headerShown: true, title: 'Lisansı bitmek üzere' }} />
        <Stack.Screen name="BekleyenKayitlar" component={BekleyenKayitlarScreen} options={{ headerShown: true, title: 'Bekleyen kayıtlar' }} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminUsersByAddress" component={AdminUsersByAddressScreen} options={{ headerShown: false }} />
        <Stack.Screen name="BusinessList" component={BusinessListScreen} />
        <Stack.Screen name="EsnafList" component={EsnafListScreen} />
        <Stack.Screen name="CekiciList" component={CekiciListScreen} />
        <Stack.Screen name="LastikciList" component={LastikciListScreen} />
        <Stack.Screen name="DuyurularList" component={DuyurularListScreen} />
        <Stack.Screen name="IsIlanlariList" component={IsIlanlariListScreen} />
        <Stack.Screen name="TaksiList" component={TaksiListScreen} />
        <Stack.Screen name="PharmacyOnDuty" component={PharmacyOnDutyScreen} />
        <Stack.Screen name="Weather" component={WeatherScreen} />
        <Stack.Screen name="Etkinlikler" component={EtkinliklerScreen} options={{ headerShown: true, title: 'Yöresel Etkinlikler' }} />
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
