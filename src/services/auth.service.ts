import { supabase } from './supabase';
import type { UsuarioActivo, LoginCredentials, RegisterCredentials } from '../types/user.types';

// ── Obtener usuario completo desde BD usando id numérico ──────────────────
export async function getUsuarioCompleto(id_usuario: number): Promise<UsuarioActivo> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id_usuario, correo, id_rol, activo, fecha_registro, auth_user_id,
      rol:roles(id_rol, nombre_rol),
      perfil_alumna:perfiles_alumna(id_perfil_alumna, id_usuario, nombre, apellidos, id_carrera, semestre_actual, biografia, foto_perfil_url, linkedin_url, github_url, fecha_actualizacion),
      perfil_ponente:perfiles_ponente(id_perfil_ponente, id_usuario, nombre, apellidos, semblanza, especialidad, empresa_institucion, foto_perfil_url, sitio_web_url, fecha_actualizacion)
    `)
    .eq('id_usuario', id_usuario)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data)  throw new Error('Usuario no encontrado');

  const u = data as any;
  return {
    ...u,
    nombre:    u.perfil_alumna?.nombre   ?? u.perfil_ponente?.nombre   ?? '',
    apellidos: u.perfil_alumna?.apellidos ?? u.perfil_ponente?.apellidos ?? '',
  } as UsuarioActivo;
}

// ── Obtener usuario completo desde BD usando auth_user_id (UUID) ──────────
async function getUsuarioPorAuthId(auth_user_id: string): Promise<UsuarioActivo> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id_usuario, correo, id_rol, activo, fecha_registro, auth_user_id,
      rol:roles(id_rol, nombre_rol),
      perfil_alumna:perfiles_alumna(id_perfil_alumna, id_usuario, nombre, apellidos, id_carrera, semestre_actual, biografia, foto_perfil_url, linkedin_url, github_url, fecha_actualizacion),
      perfil_ponente:perfiles_ponente(id_perfil_ponente, id_usuario, nombre, apellidos, semblanza, especialidad, empresa_institucion, foto_perfil_url, sitio_web_url, fecha_actualizacion)
    `)
    .eq('auth_user_id', auth_user_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data)  throw new Error('Usuario no encontrado');

  const u = data as any;
  return {
    ...u,
    nombre:    u.perfil_alumna?.nombre   ?? u.perfil_ponente?.nombre   ?? '',
    apellidos: u.perfil_alumna?.apellidos ?? u.perfil_ponente?.apellidos ?? '',
  } as UsuarioActivo;
}

// ── Registro ──────────────────────────────────────────────────────────────
export async function register(credentials: RegisterCredentials): Promise<UsuarioActivo> {
  const { nombre, apellidos, correo, contrasena } = credentials;

  const { data, error } = await supabase.auth.signUp({
    email: correo.trim().toLowerCase(),
    password: contrasena,
    options: {
      data: { nombre: nombre.trim(), apellidos: apellidos.trim() },
    },
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('No se pudo crear la cuenta');

  // El trigger fn_sync_auth_usuario crea la fila en public.usuarios automáticamente
  // Esperar brevemente para que el trigger ejecute antes de leer
  await new Promise(r => setTimeout(r, 600));

  return await getUsuarioPorAuthId(data.user.id);
}

// ── Login ─────────────────────────────────────────────────────────────────
export async function login({ correo, contrasena }: LoginCredentials): Promise<UsuarioActivo> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password: contrasena,
  });

  if (error) throw new Error('Correo o contraseña incorrectos');
  if (!data.user) throw new Error('Correo o contraseña incorrectos');

  return await getUsuarioPorAuthId(data.user.id);
}

// ── Logout ────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

// ── Modo invitado (solo memoria, sin sesión real) ─────────────────────────
export async function loginInvitado(): Promise<UsuarioActivo> {
  return {
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
}

// ── Recuperar contraseña (ahora vía Supabase Auth nativo) ─────────────────
export async function forgotPassword(correo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    correo.trim().toLowerCase(),
    {
      // Deep link que abre la app en la pantalla de nueva contraseña
      redirectTo: 'mechgirls://reset-password',
    }
  );
  if (error) throw new Error('No se pudo enviar el correo de recuperación. Intenta de nuevo.');
}

// ── Actualizar contraseña (llamar desde la pantalla de reset) ─────────────
export async function updatePassword(nuevaContrasena: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
  if (error) throw new Error(error.message);
}

// ── Restaurar sesión activa desde Supabase Auth ───────────────────────────
// Usado en authStore al inicializar — reemplaza getSesionGuardada + AsyncStorage
export async function getSesionActiva(): Promise<UsuarioActivo | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  try {
    return await getUsuarioPorAuthId(session.user.id);
  } catch {
    return null;
  }
}