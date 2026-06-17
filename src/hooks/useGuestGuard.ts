import { Alert } from 'react-native';
import { useAuth } from './useAuth';

export function useGuestGuard() {
  const { esInvitado } = useAuth();

  function requireAuth(action: () => void) {
    if (esInvitado && esInvitado()) {
      Alert.alert(
        'Crear una cuenta',
        'Para realizar esta acción necesitas registrarte. ¡Es gratis y solo toma un momento!',
        [{ text: 'Entendido', style: 'cancel' }]
      );
      return;
    }
    action();
  }

  return { esInvitado: esInvitado?.() ?? false, requireAuth };
}