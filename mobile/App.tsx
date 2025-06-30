import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import PostAuthScreen from './src/screens/PostAuthScreen';
import OrgHomeScreen from './src/screens/OrgHomeScreen';
import LoadingScreen from './src/components/LoadingScreen';

// Auth wrapper
import AuthWrapper from './src/components/AuthWrapper';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AuthWrapper>
            <Stack.Navigator
              initialRouteName="Login"
              screenOptions={{
                headerShown: false,
                gestureEnabled: false,
              }}
            >
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="PostAuth" component={PostAuthScreen} />
              <Stack.Screen name="OrgHome" component={OrgHomeScreen} />
              <Stack.Screen name="Loading" component={LoadingScreen} />
            </Stack.Navigator>
          </AuthWrapper>
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}