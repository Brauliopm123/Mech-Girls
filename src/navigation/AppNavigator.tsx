import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';

const linking: LinkingOptions<any> = {
  prefixes: ['mechgirls://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

function procesarUrl(url: string | null) {
  if (!url) return;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return;
  const fragment = url.slice(hashIndex + 1);
  const params: Record<string, string> = {};
  fragment.split('&').forEach(par => {
    const [k, ...rest] = par.split('=');
    if (k) params[k] = decodeURIComponent(rest.join('='));
  });
  const { access_token, refresh_token, type } = params;
  if (type === 'recovery' && access_token && refresh_token) {
    supabase.auth.setSession({ access_token, refresh_token });
  }
}

export default function AppNavigator() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading       = useAuthStore(s => s.isLoading);
  const inicializar     = useAuthStore(s => s.inicializar);

  useEffect(() => {
    const unsub = inicializar();
    return unsub;
  }, []);

  useEffect(() => {
    // App cerrada — URL que la abrió
    Linking.getInitialURL().then(procesarUrl);
    // App en segundo plano — URL que llega
    const sub = Linking.addEventListener('url', ({ url }) => procesarUrl(url));
    return () => sub.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});