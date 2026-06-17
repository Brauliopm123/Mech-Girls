import { create } from 'zustand';
import type { UsuarioActivo } from '../types/user.types';

interface AuthStore {
  usuario: UsuarioActivo | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUsuario: (usuario: UsuarioActivo | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;

  esAlumna: () => boolean;
  esPonente: () => boolean;
  esAdmin: () => boolean;
  esInvitado: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  usuario: null,
  isLoading: true,
  isAuthenticated: false,

  setUsuario: (usuario) =>
    set({ usuario, isAuthenticated: !!usuario }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  clearAuth: () =>
    set({ usuario: null, isAuthenticated: false }),

  // Verifica por nombre_rol (join exitoso) O por id_rol directo (fallback si RLS bloquea roles)
  esAlumna:  () => get().usuario?.rol?.nombre_rol === 'alumna'  || get().usuario?.id_rol === 1,
  esPonente: () => get().usuario?.rol?.nombre_rol === 'ponente' || get().usuario?.id_rol === 2,
  esAdmin:   () => get().usuario?.rol?.nombre_rol === 'admin'   || get().usuario?.id_rol === 3,
  esInvitado:() => get().usuario?.id_rol === 0,
}));