import { create } from 'zustand';
import { supabase } from '../services/supabase';
import * as AuthService from '../services/auth.service';
import type { UsuarioActivo } from '../types/user.types';

interface AuthStore {
  usuario:         UsuarioActivo | null;
  isLoading:       boolean;
  isAuthenticated: boolean;

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
  usuario:         null,
  isLoading:       true,
  isAuthenticated: false,

  setUsuario: (usuario) =>
    set({ usuario, isAuthenticated: !!usuario }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  clearAuth: () =>
    set({ usuario: null, isAuthenticated: false }),

  inicializar: async () => {
    // Siempre terminar en isLoading: false pase lo que pase
    try {
      const usuario = await AuthService.getSesionActiva();
      set({ usuario, isAuthenticated: !!usuario, isLoading: false });
    } catch {
      set({ usuario: null, isAuthenticated: false, isLoading: false });
    } finally {
      // Garantía extra — si algo arriba falla silenciosamente
      set((state) => state.isLoading ? { isLoading: false } : state);
    }

    // Suscribirse a cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          if (get().usuario?.id_rol !== 0) {
            set({ usuario: null, isAuthenticated: false });
          }
          return;
        }

        if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) {
          try {
            const usuario = await AuthService.getSesionActiva();
            if (usuario) set({ usuario, isAuthenticated: true });
          } catch {
            // Mantener estado actual
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  },

  esAlumna:   () => get().usuario?.rol?.nombre_rol === 'alumna'  || get().usuario?.id_rol === 1,
  esPonente:  () => get().usuario?.rol?.nombre_rol === 'ponente' || get().usuario?.id_rol === 2,
  esAdmin:    () => get().usuario?.rol?.nombre_rol === 'admin'   || get().usuario?.id_rol === 3,
  esInvitado: () => get().usuario?.id_rol === 0,
}));