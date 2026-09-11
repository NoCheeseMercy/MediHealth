import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    (async () => {
      // The 1.5s artificial delay here used to slow every single launch —
      // including warm restarts — for no functional reason.
      const onboarded = await AsyncStorage.getItem('onboarding_complete');

      if (!isAuthenticated) {
        router.replace(onboarded ? '/login' : '/onboarding');
        return;
      }

      router.replace('/(app)');
    })();
  }, [isAuthenticated, isLoading]);

  return <LoadingScreen />;
}
