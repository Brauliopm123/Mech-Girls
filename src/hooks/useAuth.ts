import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import * as AuthService from '../services/auth.service';
import type { LoginCredentials, RegisterCredentials } from '../types/user.types';

export function useAuth() {
  const {
    usuario,
    isLoading,
    isAuthenticated,
    setUsuario,
    clearAuth,
    setEnRecuperacion,
    esAlumna,
    esPonente,
    esAdmin,
    esInvitado,
  } = useAuthStore();

  const [error, setError] = useState<string | null>(null);

  async function login(credentials: LoginCredentials): Promise<void> {
    setError(null);
    // Limpiar el flag de recuperación por si quedó activo de un reset previo.
    // Si no, el SIGNED_IN de este login sería ignorado por el authStore.
    setEnRecuperacion(false);
    try {
      await AuthService.login(credentials);
    } catch (err: any) {
      const msg = err.message ?? 'Error al iniciar sesión';
      setError(msg);
      throw new Error(msg);
    }
  }

  async function loginComoInvitada() {
    setError(null);
    const invitado = await AuthService.loginInvitado();
    setUsuario(invitado);
  }

  async function register(credentials: RegisterCredentials) {
    setError(null);
    try {
      const usuario = await AuthService.register(credentials);
      setUsuario(usuario);
    } catch (err: any) {
      const msg = err.message ?? 'Error al crear la cuenta';
      setError(msg);
      throw new Error(msg);
    }
  }

  async function logout() {
    setError(null);
    // Caso invitada: no hay sesión de Supabase, limpiar store directamente.
    if (esInvitado && esInvitado()) {
      clearAuth();
      return;
    }
    // Usuario real: signOut dispara SIGNED_OUT que limpia el store
    // tras el timeout en authStore.
    try {
      await AuthService.logout();
    } catch (err: any) {
      clearAuth();
    }
  }

  async function forgotPassword(correo: string) {
    setError(null);
    try {
      await AuthService.forgotPassword(correo);
    } catch (err: any) {
      const msg = err.message ?? 'Error al enviar el correo';
      setError(msg);
      throw new Error(msg);
    }
  }

  async function updatePassword(nuevaContrasena: string) {
    setError(null);
    try {
      await AuthService.updatePassword(nuevaContrasena);
    } catch (err: any) {
      const msg = err.message ?? 'Error al actualizar la contraseña';
      setError(msg);
      throw new Error(msg);
    }
  }

  return {
    usuario,
    isLoading,
    isAuthenticated,
    error,
    esAlumna,
    esPonente,
    esAdmin,
    esInvitado,
    login,
    loginComoInvitada,
    register,
    logout,
    forgotPassword,
    updatePassword,
    clearError: () => setError(null),
  };
}