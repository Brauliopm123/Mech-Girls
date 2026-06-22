import { create } from 'zustand';
import { supabase } from '../services/supabase';
import * as AuthService from '../services/auth.service';
import type { UsuarioActivo } from '../types/user.types';

interface AuthStore {
  usuario:            UsuarioActivo | null;
  isLoading:          boolean;
  isAuthenticated:    boolean;
  _sessionCount:      number;
  _unsubscribe:       (() => void) | null;

  setUsuario:         (usuario: UsuarioActivo | null) => void;
  setLoading:         (loading: boolean) => void;
  clearAuth:          () => void;
  setLoginEnProgreso: (v: boolean) => void; // compat — no-op
  inicializar:        () => () => void;

  esAlumna:   () => boolean;
  esPonente:  () => boolean;
  esAdmin:    () => boolean;
  esInvitado: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  usuario:         null,
  isLoading:       true,
  isAuthenticated: false,
  _sessionCount:   0,
  _unsubscribe:    null,

  setUsuario: (usuario) =>
    set({ usuario, isAuthenticated: !!usuario }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  // NO toca _sessionCount — solo limpia el usuario
  clearAuth: () =>
    set({ usuario: null, isAuthenticated: false }),

  // Mantenido por compatibilidad — ya no se usa
  setLoginEnProgreso: (_v) => {},

  inicializar: () => {
    get()._unsubscribe?.();

    AuthService.getSesionActiva()
      .then(usuario => set({ usuario, isAuthenticated: !!usuario, isLoading: false }))
      .catch(() => set({ usuario: null, isAuthenticated: false, isLoading: false }));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (!session) return;
          // Incrementar contador — identifica esta sesión
          const newCount = get()._sessionCount + 1;
          set({ _sessionCount: newCount });
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true, isLoading: false });
          } catch {
            // mantener estado
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          // Ignorar sesión de invitada
          if (get().usuario?.id_rol === 0) return;
          // Guardar el contador en el momento del SIGNED_OUT
          const countAtSignOut = get()._sessionCount;
          // Esperar 400ms: si llegó un SIGNED_IN nuevo, el contador habrá subido
          setTimeout(() => {
            if (get()._sessionCount === countAtSignOut) {
              // Contador no cambió → logout real → limpiar
              set({ usuario: null, isAuthenticated: false });
            }
            // Si cambió → era el SIGNED_OUT tardío del logout anterior → ignorar
          }, 400);
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          if (!session) return;
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true, isLoading: false });
          } catch {
            // mantener estado
          }
          return;
        }

        if (event === 'USER_UPDATED') {
          if (!session) return;
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true });
          } catch {
            // mantener estado
          }
        }
      }
    );

    const unsub = () => subscription.unsubscribe();
    set({ _unsubscribe: unsub });
    return unsub;
  },

  esAlumna:   () => get().usuario?.rol?.nombre_rol === 'alumna'  || get().usuario?.id_rol === 1,
  esPonente:  () => get().usuario?.rol?.nombre_rol === 'ponente' || get().usuario?.id_rol === 2,
  esAdmin:    () => get().usuario?.rol?.nombre_rol === 'admin'   || get().usuario?.id_rol === 3,
  esInvitado: () => get().usuario?.id_rol === 0,
}));