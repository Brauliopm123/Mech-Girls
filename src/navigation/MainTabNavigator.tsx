import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Dashboard from '../screens/auth/Dashboard';
import TalleresScreen from '../screens/auth/TalleresScreen';
import CrearPublicacionScreen from '../screens/auth/CrearPublicacionScreen';
import MensajesScreen from '../screens/auth/MensajesScreen';
import PerfilScreen from '../screens/auth/PerfilScreen';
import AdminScreen from '../screens/auth/AdminScreen';
import { useAuthStore } from '../store/authStore';

const Tab = createBottomTabNavigator();

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const esAdmin    = useAuthStore(s => s.esAdmin);
  const esInvitado = useAuthStore(s => s.esInvitado);
  const isAdmin    = esAdmin();
  const isGuest    = esInvitado();

  const getColor = (name: string) => {
    const current = state.routes[state.index]?.name;
    return current === name ? '#E91E63' : '#757575';
  };

  function handleCrear() {
    if (isGuest) {
      Alert.alert(
        'Necesitas una cuenta',
        'Crea una cuenta para publicar contenido.',
        [{ text: 'Cancelar', style: 'cancel' }]
      );
      return;
    }
    navigation.navigate('Crear');
  }

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 15) }]}>

      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Inicio')}>
        <Feather name="home" size={24} color={getColor('Inicio')} />
        <Text style={[styles.navText, { color: getColor('Inicio') }]}>Inicio</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Talleres')}>
        <Feather name="book-open" size={24} color={getColor('Talleres')} />
        <Text style={[styles.navText, { color: getColor('Talleres') }]}>Eventos</Text>
      </TouchableOpacity>

      {/* FAB central — visible siempre pero bloqueado para invitados */}
      <View style={styles.fabWrapper}>
        <TouchableOpacity style={[styles.fab, isGuest && styles.fabDisabled]} onPress={handleCrear}>
          <Feather name={isGuest ? 'lock' : 'plus'} size={26} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Mensajes — oculto para invitados, reemplazado por espacio */}
      {isGuest ? (
        <View style={styles.navItem} />
      ) : (
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Mensajes')}>
          <Feather name="message-circle" size={24} color={getColor('Mensajes')} />
          <Text style={[styles.navText, { color: getColor('Mensajes') }]}>Mensajes</Text>
        </TouchableOpacity>
      )}

      {/* Último tab: Admin, Perfil normal, o Perfil-invitado */}
      {isAdmin ? (
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Admin')}>
          <Feather name="shield" size={24} color={getColor('Admin')} />
          <Text style={[styles.navText, { color: getColor('Admin') }]}>Admin</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Perfil')}>
          <Feather name="user" size={24} color={getColor('Perfil')} />
          <Text style={[styles.navText, { color: getColor('Perfil') }]}>
            {isGuest ? 'Unirse' : 'Perfil'}
          </Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

export default function MainTabNavigator() {
  const esAdmin    = useAuthStore(s => s.esAdmin);
  const esInvitado = useAuthStore(s => s.esInvitado);
  const isAdmin    = esAdmin();
  const isGuest    = esInvitado();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Inicio"    component={Dashboard} />
      <Tab.Screen name="Talleres"  component={TalleresScreen} />
      {/* Crear solo existe en el stack si no es invitado */}
      {!isGuest && <Tab.Screen name="Crear"    component={CrearPublicacionScreen} />}
      {!isGuest && <Tab.Screen name="Mensajes" component={MensajesScreen} />}
      {isAdmin
        ? <Tab.Screen name="Admin"  component={AdminScreen} />
        : <Tab.Screen name="Perfil" component={PerfilScreen} />
      }
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEEEEE',
    paddingVertical: 10, position: 'absolute', bottom: 0, width: '100%',
    elevation: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText:  { fontSize: 10, marginTop: 4 },
  fabWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 52, height: 52, backgroundColor: '#E91E63', borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#E91E63', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 5, elevation: 6, marginBottom: 4,
  },
  fabDisabled: { backgroundColor: '#BDBDBD' },
});