import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePushNotifications } from '../services/notifications.service';
import { useAuth } from '../hooks/useAuth';
import MainTabNavigator from './MainTabNavigator';
import ComentariosScreen from '../screens/auth/ComentariosScreen';
import EditarPublicacionScreen from '../screens/auth/EditarPublicacionScreen';
import PonentesScreen from '../screens/auth/PonentesScreen';
import PonentesDetalleScreen from '../screens/auth/PonentesDetalleScreen';
import ChatScreen from '../screens/auth/ChatScreen';
import SolicitudesScreen from '../screens/auth/SolicitudesScreen';
import ConstanciasScreen from '../screens/auth/ConstanciasScreen';

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  const { usuario } = useAuth();
  usePushNotifications(usuario?.id_usuario);
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"              component={MainTabNavigator} />
      <Stack.Screen name="Comentarios"       component={ComentariosScreen} />
      <Stack.Screen name="EditarPublicacion" component={EditarPublicacionScreen} />
      <Stack.Screen name="Ponentes"          component={PonentesScreen} />
      <Stack.Screen name="PonentesDetalle"   component={PonentesDetalleScreen} />
      <Stack.Screen name="Chat"              component={ChatScreen} />
      <Stack.Screen name="Solicitudes"       component={SolicitudesScreen} />
      <Stack.Screen name="Constancias" component={ConstanciasScreen} />
      {/* Login y Register ELIMINADOS de aquí — viven solo en AuthNavigator.
          Tener dos pantallas "Login" causaba que el cambio de cuenta se
          quedara atascado en la pantalla de login. El modo invitada ahora
          usa logout() para volver al AuthNavigator real. */}
    </Stack.Navigator>
  );
}