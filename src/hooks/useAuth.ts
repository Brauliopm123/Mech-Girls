import { useEffect, useState } from 'react';
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
    inicializar,
    esAlumna,
    esPonente,
    esAdmin,
    esInvitado,
  } = useAuthStore();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    inicializar().then(fn => { unsub = fn; });
    return () => unsub?.();
  }, []);

  async function login(credentials: LoginCredentials) {
    setError(null);
    try {
      const usuario = await AuthService.login(credentials);
      setUsuario(usuario);
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
    try {
      await AuthService.logout();
      clearAuth();
    } catch (err: any) {
      setError(err.message ?? 'Error al cerrar sesión');
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