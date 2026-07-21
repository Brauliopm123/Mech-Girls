import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';

const RecoveryStack = createNativeStackNavigator();

// Referencia global para navegar desde el manejador de deep links (fuera de las pantallas).
export const navigationRef = createNavigationContainerRef();

// Perfil pendiente de abrir por deep link (mechgirls://perfil/123).
// Se guarda hasta que el navegador esté listo y la usuaria esté autenticada.
let pendingPerfilId: number | null = null;

function intentarAbrirPerfil() {
  if (pendingPerfilId == null) return;
  if (!navigationRef.isReady()) return;
  if (!useAuthStore.getState().isAuthenticated) return; // aún no hay sesión: se abrirá al entrar
  const id = pendingPerfilId;
  pendingPerfilId = null;
  (navigationRef.navigate as any)('PerfilPublico', { idUsuario: id });
}

function RecoveryNavigator() {
  return (
    <RecoveryStack.Navigator screenOptions={{ headerShown: false }}>
      <RecoveryStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </RecoveryStack.Navigator>
  );
}

// NOTA: ya NO usamos el linking config de React Navigation para el reset.
// El deep link mechgirls://reset-password lo procesamos manualmente abajo
// con procesarUrl + setEnRecuperacion. Dejar el linking causaba que React
// Navigation abriera la ruta ResetPassword por su cuenta y se duplicara.

let urlProcesada: string | null = null;

function procesarUrl(url: string | null) {
  if (!url) return;
  if (url === urlProcesada) return;
  urlProcesada = url;

  // Deep link de perfil: mechgirls://perfil/123  ó  .../perfil/123
  const perfilMatch = url.match(/perfil\/(\d+)/);
  if (perfilMatch) {
    pendingPerfilId = parseInt(perfilMatch[1], 10);
    intentarAbrirPerfil();
    return;
  }

  let paramString = '';
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (hashIndex !== -1) {
    paramString = url.slice(hashIndex + 1);
  } else if (queryIndex !== -1) {
    paramString = url.slice(queryIndex + 1);
  }
  if (!paramString) return;

  const params: Record<string, string> = {};
  paramString.split('&').forEach(par => {
    const [k, ...rest] = par.split('=');
    if (k) params[k] = decodeURIComponent(rest.join('='));
  });

  const { access_token, refresh_token, code } = params;

  if (access_token && refresh_token) {
    useAuthStore.getState().setEnRecuperacion(true);
    supabase.auth.setSession({ access_token, refresh_token });
    return;
  }
  if (code) {
    useAuthStore.getState().setEnRecuperacion(true);
    supabase.auth.exchangeCodeForSession(code);
    return;
  }
}

export default function AppNavigator() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading       = useAuthStore(s => s.isLoading);
  const enRecuperacion  = useAuthStore(s => s.enRecuperacion);
  const inicializar     = useAuthStore(s => s.inicializar);

  useEffect(() => {
    const unsub = inicializar();
    return unsub;
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(procesarUrl);
    const sub = Linking.addEventListener('url', ({ url }) => procesarUrl(url));
    return () => sub.remove();
  }, []);

  // Si el link de perfil llegó antes de iniciar sesión, ábrelo al autenticarse.
  useEffect(() => {
    if (isAuthenticated) intentarAbrirPerfil();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={intentarAbrirPerfil}>
      {enRecuperacion
        ? <RecoveryNavigator key="recovery" />
        : isAuthenticated
          ? <MainNavigator key="main" />
          : <AuthNavigator key="auth" />}
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