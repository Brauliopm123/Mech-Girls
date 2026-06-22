import { supabase } from './supabase';
import type { UsuarioActivo, LoginCredentials, RegisterCredentials } from '../types/user.types';

const USUARIO_SELECT = `
  id_usuario, correo, id_rol, activo, fecha_registro, auth_user_id,
  rol:roles(id_rol, nombre_rol),
  perfil_alumna:perfiles_alumna(id_perfil_alumna, id_usuario, nombre, apellidos, id_carrera, semestre_actual, biografia, foto_perfil_url, linkedin_url, github_url, fecha_actualizacion),
  perfil_ponente:perfiles_ponente(id_perfil_ponente, id_usuario, nombre, apellidos, semblanza, especialidad, empresa_institucion, foto_perfil_url, sitio_web_url, fecha_actualizacion)
`;

function mapUsuario(u: any): UsuarioActivo {
  return {
    ...u,
    nombre:    u.perfil_alumna?.nombre    ?? u.perfil_ponente?.nombre    ?? '',
    apellidos: u.perfil_alumna?.apellidos ?? u.perfil_ponente?.apellidos ?? '',
  } as UsuarioActivo;
}

export async function getUsuarioCompleto(id_usuario: number): Promise<UsuarioActivo> {
  const { data, error } = await supabase
    .from('usuarios').select(USUARIO_SELECT)
    .eq('id_usuario', id_usuario).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)  throw new Error('Usuario no encontrado');
  return mapUsuario(data);
}

async function getUsuarioPorAuthId(auth_user_id: string): Promise<UsuarioActivo> {
  const { data, error } = await supabase
    .from('usuarios').select(USUARIO_SELECT)
    .eq('auth_user_id', auth_user_id).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No existe perfil para auth_user_id: ${auth_user_id}. El trigger pudo haber fallado al registrar.`);
  return mapUsuario(data);
}

export async function register(credentials: RegisterCredentials): Promise<UsuarioActivo> {
  const { nombre, apellidos, correo, contrasena, id_rol = 1 } = credentials;

  const { data, error } = await supabase.auth.signUp({
    email: correo.trim().toLowerCase(),
    password: contrasena,
    options: {
      data: { nombre: nombre.trim(), apellidos: apellidos.trim(), id_rol },
    },
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('No se pudo crear la cuenta');

  // Esperar trigger fn_sync_auth_usuario
  await new Promise(r => setTimeout(r, 1000));

  const usuario = await getUsuarioPorAuthId(data.user.id);
  return usuario;
}

export async function login({ correo, contrasena }: LoginCredentials): Promise<UsuarioActivo> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password: contrasena,
  });

  console.log('SUPABASE LOGIN:', JSON.stringify(error), data?.user?.id);

  if (error) throw new Error('Correo o contraseña incorrectos');
  if (!data.user) throw new Error('Correo o contraseña incorrectos');

  try {
    return await getUsuarioPorAuthId(data.user.id);
  } catch (err: any) {
    // Si el perfil no existe en public.usuarios, hacer signOut y lanzar error claro
    await supabase.auth.signOut();
    throw new Error('Tu cuenta existe pero no tiene perfil. Contacta al administrador.');
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

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

export async function forgotPassword(correo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    correo.trim().toLowerCase(),
    { redirectTo: 'mechgirls://reset-password' }
  );
  if (error) throw new Error('No se pudo enviar el correo. Intenta de nuevo.');
}

export async function updatePassword(nuevaContrasena: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nuevaContrasena });
  if (error) throw new Error(error.message);
}

export async function getSesionActiva(): Promise<UsuarioActivo | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  try {
    return await getUsuarioPorAuthId(session.user.id);
  } catch {
    return null;
  }
}