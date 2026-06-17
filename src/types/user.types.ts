export interface Rol {
  id_rol: number;
  nombre_rol: 'alumna' | 'ponente' | 'admin';
}

export interface Usuario {
  id_usuario: number;
  correo: string;
  id_rol: number;
  activo: number;
  fecha_registro: string;
  fecha_actualizacion: string;
}

export interface PerfilAlumna {
  id_perfil_alumna: number;
  id_usuario: number;
  nombre: string;
  apellidos: string;
  id_carrera?: number;
  semestre_actual?: number;
  biografia?: string;
  foto_perfil_url?: string;
  linkedin_url?: string;
  github_url?: string;
  fecha_actualizacion: string;
}

export interface PerfilPonente {
  id_perfil_ponente: number;
  id_usuario: number;
  nombre: string;
  apellidos: string;
  semblanza?: string;
  especialidad?: string;
  empresa_institucion?: string;
  foto_perfil_url?: string;
  sitio_web_url?: string;
  fecha_actualizacion: string;
}

// Usuario enriquecido con nombre/apellidos del perfil
export interface UsuarioActivo extends Usuario {
  nombre?: string;
  apellidos?: string;
  rol?: Rol;
  perfil_alumna?: PerfilAlumna;
  perfil_ponente?: PerfilPonente;
}

export interface LoginCredentials {
  correo: string;
  contrasena: string;
}

export interface RegisterCredentials {
  nombre: string;
  apellidos: string;
  correo: string;
  contrasena: string;
  id_rol?: number; // 1=alumna, 2=ponente
}
