import { create } from 'zustand';
import { supabase } from '../services/supabase';
import * as AuthService from '../services/auth.service';
import type { UsuarioActivo } from '../types/user.types';

interface AuthStore {
  usuario:            UsuarioActivo | null;
  isLoading:          boolean;
  isAuthenticated:    boolean;
  enRecuperacion:     boolean;   // true mientras se resetea la contraseña
  _sessionCount:      number;
  _unsubscribe:       (() => void) | null;

  setUsuario:         (usuario: UsuarioActivo | null) => void;
  setLoading:         (loading: boolean) => void;
  clearAuth:          () => void;
  setLoginEnProgreso: (v: boolean) => void; // compat — no-op
  setEnRecuperacion:  (v: boolean) => void;
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
  enRecuperacion:  false,
  _sessionCount:   0,
  _unsubscribe:    null,

  setUsuario: (usuario) =>
    set({ usuario, isAuthenticated: !!usuario }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  clearAuth: () =>
    set({ usuario: null, isAuthenticated: false }),

  setLoginEnProgreso: (_v) => {},

  setEnRecuperacion: (v) =>
    set({ enRecuperacion: v }),

  inicializar: () => {
    get()._unsubscribe?.();

    AuthService.getSesionActiva()
      .then(usuario => set({ usuario, isAuthenticated: !!usuario, isLoading: false }))
      .catch(() => set({ usuario: null, isAuthenticated: false, isLoading: false }));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        // PASSWORD_RECOVERY: el usuario abrió el deep link de reset.
        // Marcar enRecuperacion para que AppNavigator muestre ResetPassword
        // en lugar del dashboard, aunque la sesión quede activa.
        if (event === 'PASSWORD_RECOVERY') {
          set({ enRecuperacion: true, isLoading: false });
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (!session) return;
          // Si estamos en recuperación, NO cargar el usuario al dashboard.
          if (get().enRecuperacion) {
            set({ isLoading: false });
            return;
          }
          set({ _sessionCount: get()._sessionCount + 1 });
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true, isLoading: false });
          } catch {
            // mantener estado
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          // Si estamos en recuperación, el signOut viene del reset de
          // contraseña — ResetPasswordScreen maneja la salida con el flag.
          if (get().enRecuperacion) return;
          if (get().usuario?.id_rol === 0) return;
          const countAtSignOut = get()._sessionCount;
          setTimeout(() => {
            if (get()._sessionCount === countAtSignOut) {
              set({ usuario: null, isAuthenticated: false });
            }
          }, 500);
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