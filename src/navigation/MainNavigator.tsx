import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import ComentariosScreen from '../screens/auth/ComentariosScreen';
import EditarPublicacionScreen from '../screens/auth/EditarPublicacionScreen';
import PonentesScreen from '../screens/auth/PonentesScreen';
import PonentesDetalleScreen from '../screens/auth/PonentesDetalleScreen';
import ChatScreen from '../screens/auth/ChatScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"              component={MainTabNavigator} />
      <Stack.Screen name="Comentarios"       component={ComentariosScreen} />
      <Stack.Screen name="EditarPublicacion" component={EditarPublicacionScreen} />
      <Stack.Screen name="Ponentes"          component={PonentesScreen} />
      <Stack.Screen name="PonentesDetalle"   component={PonentesDetalleScreen} />
      <Stack.Screen name="Chat"              component={ChatScreen} />
      {/* Accesibles desde modo invitado */}
      <Stack.Screen name="Login"             component={LoginScreen} />
      <Stack.Screen name="Register"          component={RegisterScreen} />
    </Stack.Navigator>
  );
}