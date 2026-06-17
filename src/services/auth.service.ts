import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoginCredentials, RegisterCredentials, UsuarioActivo } from '../types/user.types';

const SESSION_KEY = 'mechgirls_session';

export async function register(credentials: RegisterCredentials): Promise<UsuarioActivo> {
  const { nombre, apellidos, correo, contrasena, id_rol = 1 } = credentials;
  const { data, error } = await supabase.rpc('fn_registrar_usuario', {
    p_correo: correo.trim().toLowerCase(),
    p_contrasena: contrasena,
    p_nombre: nombre.trim(),
    p_apellidos: apellidos.trim(),
    p_id_rol: id_rol,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('No se pudo crear la cuenta');
  // Traer usuario completo con rol
  const usuario = await getUsuarioCompleto((data[0] as any).id_usuario);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
  return usuario;
}

export async function login({ correo, contrasena }: LoginCredentials): Promise<UsuarioActivo> {
  const { data, error } = await supabase.rpc('fn_login', {
    p_correo: correo.trim().toLowerCase(),
    p_contrasena: contrasena,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Correo o contraseña incorrectos');
  // fn_login NO retorna el join de roles — traer usuario completo siempre
  const usuario = await getUsuarioCompleto((data[0] as any).id_usuario);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
  return usuario;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSesionGuardada(): Promise<UsuarioActivo | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UsuarioActivo;
    // Si la sesión guardada no tiene rol (sesión vieja), refrescar desde BD
    if (!parsed.rol?.nombre_rol) {
      const fresco = await getUsuarioCompleto(parsed.id_usuario);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(fresco));
      return fresco;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getUsuarioCompleto(id_usuario: number): Promise<UsuarioActivo> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id_usuario, correo, id_rol, activo, fecha_registro,
      rol:roles(id_rol, nombre_rol),
      perfil_alumna:perfiles_alumna(id_perfil_alumna, id_usuario, nombre, apellidos, id_carrera, semestre_actual, biografia, foto_perfil_url, linkedin_url, github_url, fecha_actualizacion),
      perfil_ponente:perfiles_ponente(id_perfil_ponente, id_usuario, nombre, apellidos, semblanza, especialidad, empresa_institucion, foto_perfil_url, sitio_web_url, fecha_actualizacion)
    `)
    .eq('id_usuario', id_usuario)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Usuario no encontrado');
  const u = data as any;
  const nombrePerfil = u.perfil_alumna?.nombre ?? u.perfil_ponente?.nombre ?? 'Admin';
  const apellidosPerfil = u.perfil_alumna?.apellidos ?? u.perfil_ponente?.apellidos ?? '';
  return { ...u, nombre: nombrePerfil, apellidos: apellidosPerfil } as UsuarioActivo;
}

// ── Recuperar contraseña ──────────────────────────────────────
export async function loginInvitado(): Promise<UsuarioActivo> {
  const invitado: UsuarioActivo = {
    id_usuario: -1,
    correo: 'invitado@mechgirls.app',
    id_rol: 0,
    activo: 1,
    fecha_registro: new Date().toISOString(),
    fecha_actualizacion: new Date().toISOString(),
    nombre: 'Invitada',
    apellidos: '',
    rol: { id_rol: 0, nombre_rol: 'invitado' },
    perfil_alumna: null,
    perfil_ponente: null,
  } as any;
  // No se guarda en AsyncStorage — sesión solo en memoria
  return invitado;
}

export async function forgotPassword(correo: string): Promise<void> {
  const { error } = await supabase.functions.invoke('reset-password', {
    body: { correo: correo.trim().toLowerCase() },
  });
  if (error) throw new Error('No se pudo enviar el correo de recuperación. Intenta de nuevo.');
}