import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import BusinessLoginScreen from './src/screens/BusinessLoginScreen';
import UserLoginScreen from './src/screens/UserLoginScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import AdminSignUpScreen from './src/screens/AdminSignUpScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import BusinessSignUpScreen from './src/screens/BusinessSignUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BusinessMainScreen from './src/screens/BusinessMainScreen';
import YoreselBusinessLoginScreen from './src/screens/YoreselBusinessLoginScreen';
import YoreselBusinessMainScreen from './src/screens/YoreselBusinessMainScreen';
import PremiumListingLoginScreen from './src/screens/PremiumListingLoginScreen';
import PremiumListingMainScreen from './src/screens/PremiumListingMainScreen';
import AdminMainScreen from './src/screens/AdminMainScreen';
import AdminUsersScreen from './src/screens/AdminUsersScreen';
import AdminUsersByAddressScreen from './src/screens/AdminUsersByAddressScreen';
import LisansBitmekUzereScreen from './src/screens/LisansBitmekUzereScreen';
import BekleyenKayitlarScreen from './src/screens/BekleyenKayitlarScreen';
import BusinessListScreen from './src/screens/BusinessListScreen';
import EsnafListScreen from './src/screens/EsnafListScreen';
import CekiciListScreen from './src/screens/CekiciListScreen';
import LastikciListScreen from './src/screens/LastikciListScreen';
import DuyurularListScreen from './src/screens/DuyurularListScreen';
import IsIlanlariListScreen from './src/screens/IsIlanlariListScreen';
import TaksiListScreen from './src/screens/TaksiListScreen';
import PharmacyOnDutyScreen from './src/screens/PharmacyOnDutyScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import EtkinliklerScreen from './src/screens/EtkinliklerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#34C759',
        tabBarInactiveTintColor: '#8E8E93',
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
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
        />
        <Stack.Screen 
          name="BusinessLogin" 
          component={BusinessLoginScreen}
        />
        <Stack.Screen 
          name="UserLogin" 
          component={UserLoginScreen}
        />
        <Stack.Screen 
          name="AdminLogin" 
          component={AdminLoginScreen}
        />
        <Stack.Screen 
          name="AdminSignUp" 
          component={AdminSignUpScreen}
        />
        <Stack.Screen 
          name="SignUp" 
          component={SignUpScreen}
        />
        <Stack.Screen 
          name="BusinessSignUp" 
          component={BusinessSignUpScreen}
        />
        <Stack.Screen 
          name="BusinessMain" 
          component={BusinessMainScreen}
        />
        <Stack.Screen
          name="YoreselBusinessLogin"
          component={YoreselBusinessLoginScreen}
        />
        <Stack.Screen
          name="YoreselBusinessMain"
          component={YoreselBusinessMainScreen}
        />
        <Stack.Screen
          name="PremiumListingLogin"
          component={PremiumListingLoginScreen}
        />
        <Stack.Screen
          name="PremiumListingMain"
          component={PremiumListingMainScreen}
        />
        <Stack.Screen 
          name="AdminMain" 
          component={AdminMainScreen}
        />
        <Stack.Screen 
          name="LisansBitmekUzere"
          component={LisansBitmekUzereScreen}
          options={{ headerShown: true, title: 'Lisansı bitmek üzere' }}
        />
        <Stack.Screen 
          name="BekleyenKayitlar"
          component={BekleyenKayitlarScreen}
          options={{ headerShown: true, title: 'Bekleyen kayıtlar' }}
        />
        <Stack.Screen
          name="AdminUsers"
          component={AdminUsersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminUsersByAddress"
          component={AdminUsersByAddressScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="BusinessList" 
          component={BusinessListScreen}
        />
        <Stack.Screen 
          name="EsnafList" 
          component={EsnafListScreen}
        />
        <Stack.Screen 
          name="CekiciList" 
          component={CekiciListScreen}
        />
        <Stack.Screen 
          name="LastikciList" 
          component={LastikciListScreen}
        />
        <Stack.Screen 
          name="DuyurularList" 
          component={DuyurularListScreen}
        />
        <Stack.Screen 
          name="IsIlanlariList" 
          component={IsIlanlariListScreen}
        />
        <Stack.Screen 
          name="TaksiList" 
          component={TaksiListScreen}
        />
        <Stack.Screen 
          name="PharmacyOnDuty" 
          component={PharmacyOnDutyScreen}
        />
        <Stack.Screen 
          name="Weather" 
          component={WeatherScreen}
        />
        <Stack.Screen
          name="Etkinlikler"
          component={EtkinliklerScreen}
          options={{ headerShown: true, title: 'Yöresel Etkinlikler' }}
        />
        <Stack.Screen 
          name="Main" 
          component={TabNavigator}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});


