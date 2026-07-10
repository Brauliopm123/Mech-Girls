import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Cómo se muestran las notificaciones con la app abierta (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pide permiso, obtiene el Expo Push Token y lo guarda en la BD
 * ligado al usuario. Devuelve el token o null si falla / no hay permiso.
 */
export async function registrarPushToken(idUsuario: number): Promise<string | null> {
  // Las push solo funcionan en dispositivo físico, no en emulador
  if (!Device.isDevice) {
    console.log('[push] Se requiere un dispositivo físico para push notifications');
    return null;
  }

  // Canal de Android (obligatorio para mostrar notificaciones)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E91E63',
    });
  }

  // Pedir permiso (si no está ya concedido)
  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;
  if (existente !== 'granted') {
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    status = nuevo;
  }
  if (status !== 'granted') {
    console.log('[push] Permiso de notificaciones denegado');
    return null;
  }

  // Obtener el token usando el projectId de EAS
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.log('[push] Falta projectId de EAS en app.json');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Guardar en la BD con la función que ya tienes
    const { error } = await supabase.rpc('fn_guardar_push_token', {
      p_id_usuario: idUsuario,
      p_token: token,
    });

    if (error) {
      console.log('[push] Error guardando token:', error.message);
      return null;
    }

    console.log('[push] Token registrado:', token);
    return token;
  } catch (err: any) {
    console.log('[push] Error obteniendo token:', err?.message ?? err);
    return null;
  }
}

/**
 * Hook para usar dentro de un componente autenticado.
 * Registra el token al montar y engancha los listeners de recepción.
 */
export function usePushNotifications(idUsuario: number | undefined) {
  const respuestaListener = useRef<Notifications.EventSubscription>();
  const recibidoListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!idUsuario) return;

    registrarPushToken(idUsuario);

    // Notificación recibida con la app en primer plano
    recibidoListener.current = Notifications.addNotificationReceivedListener(notif => {
      console.log('[push] Recibida en foreground:', notif.request.content.title);
    });

    // El usuario tocó la notificación (app en background o cerrada)
    respuestaListener.current = Notifications.addNotificationResponseReceivedListener(resp => {
      const data = resp.notification.request.content.data;
      console.log('[push] Notificación tocada:', data);
      // Aquí luego puedes navegar según data.tipo / data.id_referencia
    });

    return () => {
      recibidoListener.current?.remove();
      respuestaListener.current?.remove();
    };
  }, [idUsuario]);
}