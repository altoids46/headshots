import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { user, profile, isLoading } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (!isLoading) {
      if (user && profile?.organization_id) {
        // User is authenticated and has complete profile
        navigation.navigate('OrgHome' as never);
      } else if (user && !profile?.organization_id) {
        // User is authenticated but needs to complete profile
        navigation.navigate('PostAuth' as never);
      } else {
        // User is not authenticated
        navigation.navigate('Login' as never);
      }
    }
  }, [user, profile, isLoading, navigation]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
};

export default AuthWrapper;