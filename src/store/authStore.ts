import { create } from 'zustand';
import { supabase } from '../services/supabase';
import * as AuthService from '../services/auth.service';
import type { UsuarioActivo } from '../types/user.types';

interface AuthStore {
  usuario:            UsuarioActivo | null;
  isLoading:          boolean;
  isAuthenticated:    boolean;
  _suscripcionActiva: boolean;
  _ultimoSignIn:      number; // timestamp del último SIGNED_IN

  setUsuario:  (usuario: UsuarioActivo | null) => void;
  setLoading:  (loading: boolean) => void;
  clearAuth:   () => void;
  inicializar: () => Promise<() => void>;

  esAlumna:   () => boolean;
  esPonente:  () => boolean;
  esAdmin:    () => boolean;
  esInvitado: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  usuario:            null,
  isLoading:          true,
  isAuthenticated:    false,
  _suscripcionActiva: false,
  _ultimoSignIn:      0,

  setUsuario: (usuario) =>
    set({ usuario, isAuthenticated: !!usuario }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  clearAuth: () =>
    set({ usuario: null, isAuthenticated: false }),

  inicializar: async () => {
    if (get()._suscripcionActiva) return () => {};
    set({ _suscripcionActiva: true });

    try {
      const usuario = await AuthService.getSesionActiva();
      set({ usuario, isAuthenticated: !!usuario, isLoading: false });
    } catch {
      set({ usuario: null, isAuthenticated: false, isLoading: false });
    } finally {
      set((state) => state.isLoading ? { isLoading: false } : state);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          if (!session) return;
          // Registrar timestamp del login
          const ahora = Date.now();
          set({ _ultimoSignIn: ahora });
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true, isLoading: false });
          } catch {
            // Mantener estado
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          // Si hubo un SIGNED_IN en los últimos 3 segundos, ignorar este SIGNED_OUT
          // Es el logout de la sesión anterior llegando tarde
          const msSinceSignIn = Date.now() - get()._ultimoSignIn;
          if (msSinceSignIn < 3000) return;

          if (get().usuario?.id_rol !== 0) {
            set({ usuario: null, isAuthenticated: false });
          }
          return;
        }

        if (['TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) {
          if (!session) return;
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true });
          } catch {
            // Mantener estado
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      set({ _suscripcionActiva: false });
    };
  },

  esAlumna:   () => get().usuario?.rol?.nombre_rol === 'alumna'  || get().usuario?.id_rol === 1,
  esPonente:  () => get().usuario?.rol?.nombre_rol === 'ponente' || get().usuario?.id_rol === 2,
  esAdmin:    () => get().usuario?.rol?.nombre_rol === 'admin'   || get().usuario?.id_rol === 3,
  esInvitado: () => get().usuario?.id_rol === 0,
}));