import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { Colors } from '../constants/colors';

const linking = {
  prefixes: ['mechgirls://'],
  config: {
    screens: {
      ResetPassword: {
        path: 'reset-password',
        parse: {
          token:  (token: string)  => token,
          correo: (correo: string) => decodeURIComponent(correo),
        },
      },
    },
  },
};

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [limpiando, setLimpiando] = useState(true);

  useEffect(() => {
    // Limpiar sesión vieja del sistema bcrypt anterior
    // Este bloque se puede eliminar después de que todos los usuarios
    // hayan iniciado sesión al menos una vez con el nuevo sistema
    AsyncStorage.removeItem('mechgirls_session').finally(() => {
      setLimpiando(false);
    });
  }, []);

  if (isLoading || limpiando) {
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