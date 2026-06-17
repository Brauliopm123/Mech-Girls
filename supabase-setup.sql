-- ============================================================
-- MECH GIRLS — Script de apoyo para Supabase
-- Ejecutar en: Supabase → SQL Editor
-- La estructura principal (tablas, FK, triggers) ya viene del
-- archivo mechGirls_db.sql proporcionado por el equipo.
-- Este script agrega únicamente las funciones RPC que la app
-- necesita para autenticación segura.
-- ============================================================

-- Extensión para hash de contraseñas (pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Datos iniciales: roles ──────────────────────────────────
INSERT INTO public.roles (id_rol, nombre_rol) VALUES
  (1, 'alumna'),
  (2, 'ponente'),
  (3, 'admin')
ON CONFLICT DO NOTHING;

-- ─── RPC: Registrar usuario con contraseña hasheada ─────────
CREATE OR REPLACE FUNCTION public.fn_registrar_usuario(
  p_nombre      TEXT,
  p_apellido    TEXT,
  p_correo      TEXT,
  p_contrasena  TEXT,
  p_id_rol      INTEGER DEFAULT 1
)
RETURNS SETOF public.usuarios
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_usuario public.usuarios;
BEGIN
  INSERT INTO public.usuarios (nombre, apellido, correo, contrasena, id_rol)
  VALUES (
    p_nombre,
    p_apellido,
    LOWER(TRIM(p_correo)),
    crypt(p_contrasena, gen_salt('bf')),  -- bcrypt
    p_id_rol
  )
  RETURNING * INTO v_usuario;

  RETURN NEXT v_usuario;
END;
$$;

-- ─── RPC: Login — valida credenciales y devuelve usuario ─────
CREATE OR REPLACE FUNCTION public.fn_login(
  p_correo      TEXT,
  p_contrasena  TEXT
)
RETURNS TABLE (
  id_usuario        BIGINT,
  correo            VARCHAR,
  nombre            VARCHAR,
  apellido          VARCHAR,
  id_rol            INTEGER,
  fecha_registro    TIMESTAMP,
  fecha_actualizacion TIMESTAMP
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id_usuario, u.correo, u.nombre, u.apellido,
    u.id_rol, u.fecha_registro, u.fecha_actualizacion
  FROM public.usuarios u
  WHERE u.correo = LOWER(TRIM(p_correo))
    AND u.contrasena = crypt(p_contrasena, u.contrasena);

  -- Si no devuelve filas, las credenciales son incorrectas
END;
$$;

-- ─── Row Level Security ──────────────────────────────────────
-- Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_alumna  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_ponente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes_publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones    ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de lectura (ajustar según necesidades)
CREATE POLICY "Leer usuarios autenticados"
  ON public.usuarios FOR SELECT USING (true);

CREATE POLICY "Leer publicaciones"
  ON public.publicaciones FOR SELECT USING (true);

CREATE POLICY "Leer eventos"
  ON public.eventos FOR SELECT USING (true);

CREATE POLICY "Leer ponentes"
  ON public.perfiles_ponente FOR SELECT USING (true);

CREATE POLICY "Insertar publicacion propia"
  ON public.publicaciones FOR INSERT WITH CHECK (true);

CREATE POLICY "Insertar comentario"
  ON public.comentarios FOR INSERT WITH CHECK (true);

CREATE POLICY "Insertar like"
  ON public.likes_publicacion FOR INSERT WITH CHECK (true);

CREATE POLICY "Eliminar like propio"
  ON public.likes_publicacion FOR DELETE USING (true);

CREATE POLICY "Inscribirse a evento"
  ON public.inscripciones FOR INSERT WITH CHECK (true);