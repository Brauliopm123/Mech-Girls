-- 1. CREACIÓN DE TABLAS INDEPENDIENTES (Sin llaves foráneas aún)
CREATE TABLE public.roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

CREATE TABLE public.carreras (
    id_carrera SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    abreviatura VARCHAR(20)
);

-- 2. CREACIÓN DE USUARIOS (Depende de roles)
CREATE TABLE public.usuarios (
    id_usuario BIGSERIAL PRIMARY KEY,
    correo VARCHAR(255) UNIQUE NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    id_rol INTEGER DEFAULT 1 NOT NULL REFERENCES public.roles(id_rol),
    activo INTEGER DEFAULT 1 NOT NULL,
    fecha_registro TIMESTAMP DEFAULT NOW() NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. PERFILES (Dependen de usuarios y carreras)
CREATE TABLE public.perfiles_alumna (
    id_perfil_alumna BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT UNIQUE NOT NULL REFERENCES public.usuarios(id_usuario),
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    id_carrera INTEGER REFERENCES public.carreras(id_carrera),
    semestre_actual INTEGER,
    biografia TEXT,
    foto_perfil_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    github_url VARCHAR(255),
    fecha_actualizacion TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE public.perfiles_ponente (
    id_perfil_ponente BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT UNIQUE NOT NULL REFERENCES public.usuarios(id_usuario),
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    semblanza TEXT,
    especialidad VARCHAR(255),
    empresa_institucion VARCHAR(255),
    foto_perfil_url VARCHAR(255),
    sitio_web_url VARCHAR(255),
    fecha_actualizacion TIMESTAMP DEFAULT NOW() NOT NULL
);<<

-- 4. PUBLICACIONES E INTERACCIONES (Dependen de usuarios)
CREATE TABLE public.publicaciones (
    id_publicacion BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
    contenido_texto TEXT,
    url_referencia VARCHAR(255),
    descripcion_url VARCHAR(255),
    tipo_publicacion VARCHAR(50) DEFAULT 'general',
    fecha_publicacion TIMESTAMP DEFAULT NOW() NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE public.likes_publicacion (
    id_usuario BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
    id_publicacion BIGINT NOT NULL REFERENCES public.publicaciones(id_publicacion),
    fecha_like TIMESTAMP DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id_usuario, id_publicacion)
);

CREATE TABLE public.comentarios (
    id_comentario BIGSERIAL PRIMARY KEY,
    id_publicacion BIGINT NOT NULL REFERENCES public.publicaciones(id_publicacion),
    id_usuario BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
    contenido TEXT NOT NULL,
    fecha_comentario TIMESTAMP DEFAULT NOW() NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 5. EVENTOS E INSCRIPCIONES (Dependen de perfiles y usuarios)
CREATE TABLE public.eventos (
    id_evento BIGSERIAL PRIMARY KEY,
    id_ponente BIGINT NOT NULL REFERENCES public.perfiles_ponente(id_perfil_ponente),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo_evento VARCHAR(50) DEFAULT 'taller',
    duracion_horas DECIMAL(4,1) NOT NULL,
    costo DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    fecha_hora_inicio TIMESTAMP NOT NULL,
    cupo_maximo INTEGER NOT NULL,
    lugar VARCHAR(255),
    enlace_virtual VARCHAR(255),
    fecha_actualizacion TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE public.inscripciones (
    id_inscripcion BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
    id_evento BIGINT NOT NULL REFERENCES public.eventos(id_evento),
    fecha_inscripcion TIMESTAMP DEFAULT NOW() NOT NULL,
    estado VARCHAR(30) DEFAULT 'confirmada',
    UNIQUE (id_usuario, id_evento)
);

-- 6. FUNCIONES Y TRIGGERS
-- Función genérica para actualizar fechas
CREATE OR REPLACE FUNCTION public.fn_actualizar_fecha_actualizacion()
RETURNS trigger AS $$
BEGIN
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asignación de triggers de fecha a las tablas correspondientes
CREATE TRIGGER trg_actualizar_fecha_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_fecha_actualizacion();
CREATE TRIGGER trg_actualizar_fecha_perfil_alumna BEFORE UPDATE ON public.perfiles_alumna FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_fecha_actualizacion();
CREATE TRIGGER trg_actualizar_fecha_perfil_ponente BEFORE UPDATE ON public.perfiles_ponente FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_fecha_actualizacion();
CREATE TRIGGER trg_actualizar_fecha_publicaciones BEFORE UPDATE ON public.publicaciones FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_fecha_actualizacion();
CREATE TRIGGER trg_actualizar_fecha_comentarios BEFORE UPDATE ON public.comentarios FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_fecha_actualizacion();
CREATE TRIGGER trg_actualizar_fecha_eventos BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_fecha_actualizacion();

-- Función y trigger para validar el cupo máximo
CREATE OR REPLACE FUNCTION public.fn_validar_cupo_evento()
RETURNS trigger AS $$
DECLARE
    v_cupo_maximo INTEGER;
    v_inscritos INTEGER;
BEGIN
    SELECT cupo_maximo INTO v_cupo_maximo FROM public.eventos WHERE id_evento = NEW.id_evento;
    
    SELECT COUNT(*) INTO v_inscritos FROM public.inscripciones WHERE id_evento = NEW.id_evento AND estado != 'cancelada';

    IF v_inscritos >= v_cupo_maximo THEN
        RAISE EXCEPTION 'El evento con id % ya alcanzó su cupo máximo de % participantes. Inscripciones cerradas.', NEW.id_evento, v_cupo_maximo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_cupo BEFORE INSERT ON public.inscripciones FOR EACH ROW EXECUTE FUNCTION public.fn_validar_cupo_evento();

CREATE EXTENSION IF NOT EXISTS pgcrypto;

Datos iniciales: roles
INSERT INTO public.roles (id_rol, nombre_rol) VALUES
  (1, 'alumna'),
  (2, 'ponente'),
  (3, 'admin')
ON CONFLICT DO NOTHING;

RPC: Registrar usuario con contraseña hasheada
CREATE OR REPLACE FUNCTION public.fn_registrar_usuario(
  p_correo      TEXT,
  p_contrasena  TEXT,
  p_nombre      TEXT,
  p_apellidos   TEXT,
  p_id_rol      INTEGER DEFAULT 1
)
RETURNS TABLE (
  id_usuario          BIGINT,
  correo              VARCHAR,
  id_rol              INTEGER,
  activo              INTEGER,
  fecha_registro      TIMESTAMP,
  fecha_actualizacion TIMESTAMP
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  nuevo_id BIGINT;
BEGIN
  INSERT INTO public.usuarios (correo, contrasena_hash, id_rol, activo)
  VALUES (
    LOWER(TRIM(p_correo)),
    crypt(p_contrasena, gen_salt('bf')),
    p_id_rol,
    1
  )
  RETURNING public.usuarios.id_usuario INTO nuevo_id;

  -- Alumna y Admin usan perfiles_alumna; Ponente usa perfiles_ponente
  IF p_id_rol = 1 OR p_id_rol = 3 THEN
    INSERT INTO public.perfiles_alumna (id_usuario, nombre, apellidos)
    VALUES (nuevo_id, p_nombre, p_apellidos);
  ELSIF p_id_rol = 2 THEN
    INSERT INTO public.perfiles_ponente (id_usuario, nombre, apellidos)
    VALUES (nuevo_id, p_nombre, p_apellidos);
  END IF;

  RETURN QUERY
  SELECT u.id_usuario, u.correo, u.id_rol,
         u.activo, u.fecha_registro, u.fecha_actualizacion
  FROM public.usuarios u
  WHERE u.id_usuario = nuevo_id;
END;
$$;

RPC: Login — valida credenciales y devuelve usuario
CREATE OR REPLACE FUNCTION public.fn_login(
  p_correo      TEXT,
  p_contrasena  TEXT
)
RETURNS TABLE (
  id_usuario          BIGINT,
  correo              VARCHAR,
  id_rol              INTEGER,
  activo              INTEGER,
  nombre              VARCHAR,
  apellidos           VARCHAR,
  fecha_registro      TIMESTAMP,
  fecha_actualizacion TIMESTAMP
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id_usuario,
    u.correo,
    u.id_rol,
    u.activo,
    COALESCE(pa.nombre, pp.nombre)::VARCHAR    AS nombre,
    COALESCE(pa.apellidos, pp.apellidos)::VARCHAR AS apellidos,
    u.fecha_registro,
    u.fecha_actualizacion
  FROM public.usuarios u
  LEFT JOIN public.perfiles_alumna  pa ON pa.id_usuario = u.id_usuario
  LEFT JOIN public.perfiles_ponente pp ON pp.id_usuario = u.id_usuario
  WHERE u.correo = LOWER(TRIM(p_correo))
    AND u.contrasena_hash = crypt(p_contrasena, u.contrasena_hash)
    AND u.activo = 1;
END;
$$;

Row Level Security
Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_alumna  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_ponente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes_publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones    ENABLE ROW LEVEL SECURITY;

Políticas básicas de lectura (ajustar según necesidades)
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

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leer roles" ON public.roles FOR SELECT USING (true);

ALTER TABLE public.usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_alumna  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_ponente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes_publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios       ENABLE ROW LEVEL SECURITY;
 
ALTER TABLE public.publicaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leer publicaciones"    ON public.publicaciones;
DROP POLICY IF EXISTS "Insertar publicacion"  ON public.publicaciones;
CREATE POLICY "Leer publicaciones"   ON public.publicaciones FOR SELECT USING (true);
CREATE POLICY "Insertar publicacion" ON public.publicaciones FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizar perfil ponente" ON public.perfiles_ponente;
CREATE POLICY "Actualizar perfil ponente" ON public.perfiles_ponente FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Actualizar perfil alumna" ON public.perfiles_alumna;
CREATE POLICY "Actualizar perfil alumna" ON public.perfiles_alumna FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Leer usuarios"           ON public.usuarios;
DROP POLICY IF EXISTS "Insertar usuario"        ON public.usuarios;
DROP POLICY IF EXISTS "Leer perfil alumna"      ON public.perfiles_alumna;
DROP POLICY IF EXISTS "Insertar perfil alumna"  ON public.perfiles_alumna;
DROP POLICY IF EXISTS "Leer perfil ponente"     ON public.perfiles_ponente;
DROP POLICY IF EXISTS "Insertar perfil ponente" ON public.perfiles_ponente;
 
CREATE POLICY "Leer usuarios"           ON public.usuarios         FOR SELECT USING (true);
CREATE POLICY "Insertar usuario"        ON public.usuarios         FOR INSERT WITH CHECK (true);
CREATE POLICY "Leer perfil alumna"      ON public.perfiles_alumna  FOR SELECT USING (true);
CREATE POLICY "Insertar perfil alumna"  ON public.perfiles_alumna  FOR INSERT WITH CHECK (true);
CREATE POLICY "Leer perfil ponente"     ON public.perfiles_ponente FOR SELECT USING (true);
CREATE POLICY "Insertar perfil ponente" ON public.perfiles_ponente FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leer likes"        ON public.likes_publicacion;
DROP POLICY IF EXISTS "Insertar like"     ON public.likes_publicacion;
DROP POLICY IF EXISTS "Eliminar like"     ON public.likes_publicacion;
DROP POLICY IF EXISTS "Leer comentarios"  ON public.comentarios;
DROP POLICY IF EXISTS "Insertar comentario" ON public.comentarios;

CREATE POLICY "Leer likes"          ON public.likes_publicacion FOR SELECT USING (true);
CREATE POLICY "Insertar like"       ON public.likes_publicacion FOR INSERT WITH CHECK (true);
CREATE POLICY "Eliminar like"       ON public.likes_publicacion FOR DELETE USING (true);
CREATE POLICY "Leer comentarios"    ON public.comentarios       FOR SELECT USING (true);
CREATE POLICY "Insertar comentario" ON public.comentarios       FOR INSERT WITH CHECK (true);

DROP view public.vw_feed_publicaciones
CREATE OR REPLACE VIEW public.vw_feed_publicaciones AS
SELECT
  p.id_publicacion AS id,
  p.contenido_texto AS content,
  p.tipo_publicacion AS tag,
  p.fecha_publicacion AS created_at,
  p.url_referencia,
  p.link_url,
  p.id_usuario,
  COALESCE(pa.nombre, pp.nombre, '') AS user_name,
  COALESCE(pa.apellidos, pp.apellidos, '') AS user_last_name,
  COALESCE(pa.foto_perfil_url, pp.foto_perfil_url, NULL) AS user_foto,
  (SELECT COUNT(*) FROM public.likes_publicacion lp WHERE lp.id_publicacion = p.id_publicacion) AS likes,
  (SELECT COUNT(*) FROM public.comentarios c WHERE c.id_publicacion = p.id_publicacion) AS comments,
  COALESCE((
    SELECT json_agg(json_build_object(
             'id', ap.id_archivo,
             'url', ap.url,
             'tipo', ap.tipo_archivo,
             'nombre', ap.nombre_original
           ) ORDER BY ap.id_archivo)
    FROM public.archivos_publicacion ap
    WHERE ap.id_publicacion = p.id_publicacion
  ), '[]'::json) AS archivos
FROM public.publicaciones p
LEFT JOIN public.perfiles_alumna  pa ON pa.id_usuario = p.id_usuario
LEFT JOIN public.perfiles_ponente pp ON pp.id_usuario = p.id_usuario;

  SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('nombre', 'apellido', 'nombre_completo')
ORDER BY table_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('perfiles_alumna', 'perfiles_ponente')
ORDER BY table_name, ordinal_position;

SELECT * FROM public.fn_registrar_usuario(
  'luisa@uteq.com',
  'mechgirls',
  'Luisa',
  'López Ríos',
  1
);

SELECT * FROM public.fn_registrar_usuario(
  'luisa@uteq.com',
  'mechgirls',
  'Luisa',
  'López Ríos',
  1
);

DROP FUNCTION IF EXISTS public.fn_registrar_usuario(TEXT, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.fn_login(TEXT, TEXT);

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('publicaciones', 'comentarios', 'likes_publicacion')
ORDER BY table_name, ordinal_position;

SELECT column_name, udt_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'publicaciones'
AND column_name LIKE '%tipo%';

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('eventos', 'inscripciones')
ORDER BY table_name, ordinal_position;

-- Política para subir archivos al bucket media
CREATE POLICY "Subir archivos media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media');

-- Política para leer archivos públicamente
CREATE POLICY "Leer archivos media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Política para eliminar archivos propios
CREATE POLICY "Eliminar archivos media"
ON storage.objects FOR DELETE
USING (bucket_id = 'media');

DROP POLICY "Permitir subidas 1ps738_0" ON storage.objects;

-- ─── Ejecutar en Supabase SQL Editor ────────────────────────────────────────
-- Agrega políticas faltantes para comentarios y registro de ponentes
-- 3. Inscripciones: leer propias
CREATE POLICY "Leer inscripciones"
  ON public.inscripciones FOR SELECT USING (true);

-- 4. Cancelar/actualizar inscripción propia
CREATE POLICY "Actualizar inscripcion propia"
  ON public.inscripciones FOR UPDATE USING (true);

-- 6. Actualizar semblanza propia (ponente)
CREATE POLICY "Actualizar perfil ponente propio"
  ON public.perfiles_ponente FOR UPDATE USING (true);

-- 8. Insertar evento (taller/conferencia) — cualquier usuaria autenticada
CREATE POLICY "Insertar evento"
  ON public.eventos FOR INSERT WITH CHECK (true);

-- ─── Ejecutar en Supabase SQL Editor ────────────────────────────────────────
-- Hace id_ponente nullable en eventos para que alumnas puedan crear talleres
-- sin necesitar un ponente asignado.
 
ALTER TABLE public.eventos
  ALTER COLUMN id_ponente DROP NOT NULL;
 
-- Verificar
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'eventos' AND column_name = 'id_ponente';

ALTER TABLE eventos ADD COLUMN temario text, ADD COLUMN nombre_ponente text;

-- ═══════════════════════════════════════════════════════
-- FIX: Política UPDATE para eventos (editar talleres)
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Actualizar evento" ON public.eventos;
CREATE POLICY "Actualizar evento"
  ON public.eventos FOR UPDATE
  USING (true)
  WITH CHECK (true);
 
-- ═══════════════════════════════════════════════════════
-- FIX: Política DELETE para eventos
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Eliminar evento" ON public.eventos;
CREATE POLICY "Eliminar evento"
  ON public.eventos FOR DELETE
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- FIX: Funciones RPC para editar y eliminar publicaciones
-- Usan SECURITY DEFINER → bypasean RLS completamente
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Editar publicación ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_editar_publicacion(
  p_id_publicacion   BIGINT,
  p_id_usuario       BIGINT,
  p_contenido_texto  TEXT,
  p_tipo_publicacion VARCHAR(50),
  p_link_url         TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  filas_afectadas INTEGER;
BEGIN
  UPDATE public.publicaciones
  SET
    contenido_texto  = p_contenido_texto,
    tipo_publicacion = p_tipo_publicacion,
    link_url         = CASE WHEN p_link_url IS NOT NULL THEN p_link_url ELSE link_url END
  WHERE id_publicacion = p_id_publicacion
    AND id_usuario     = p_id_usuario;

  GET DIAGNOSTICS filas_afectadas = ROW_COUNT;
  RETURN filas_afectadas > 0;
END;
$$;

-- ── 2. Eliminar publicación ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_eliminar_publicacion(
  p_id_publicacion BIGINT,
  p_id_usuario     BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  filas_afectadas INTEGER;
BEGIN
  -- Borrar dependencias primero
  DELETE FROM public.likes_publicacion WHERE id_publicacion = p_id_publicacion;
  DELETE FROM public.comentarios        WHERE id_publicacion = p_id_publicacion;

  -- Borrar publicación solo si el usuario es el autor
  DELETE FROM public.publicaciones
  WHERE id_publicacion = p_id_publicacion
    AND id_usuario     = p_id_usuario;

  GET DIAGNOSTICS filas_afectadas = ROW_COUNT;
  RETURN filas_afectadas > 0;
END;
$$;

-- ── 3. Verificación ─────────────────────────────────────────────────────
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('fn_editar_publicacion', 'fn_eliminar_publicacion');


-- ═══════════════════════════════════════════════════════════════════════
-- FIX: Función para recuperación de contraseña
-- Como el sistema usa contraseñas hasheadas con bcrypt (no Supabase Auth),
-- no es posible enviar email automático sin un servicio externo.
-- Esta función verifica si el correo existe y retorna un token temporal.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_verificar_correo_recuperacion(
  p_correo TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  existe BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.usuarios
    WHERE correo = LOWER(TRIM(p_correo)) AND activo = 1
  ) INTO existe;
  RETURN existe;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- SETUP COMPLETO: Mensajes, Notificaciones, Reset Password
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TABLA MENSAJES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensajes (
  id_mensaje    BIGSERIAL PRIMARY KEY,
  id_emisor     BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
  id_receptor   BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
  contenido     TEXT NOT NULL,
  leido         BOOLEAN DEFAULT FALSE,
  fecha_envio   TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mensajes_emisor   ON public.mensajes(id_emisor);
CREATE INDEX IF NOT EXISTS idx_mensajes_receptor ON public.mensajes(id_receptor);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha    ON public.mensajes(fecha_envio DESC);

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leer mensajes propios"    ON public.mensajes;
DROP POLICY IF EXISTS "Enviar mensajes"          ON public.mensajes;
DROP POLICY IF EXISTS "Marcar mensajes leidos"   ON public.mensajes;

CREATE POLICY "Leer mensajes propios"  ON public.mensajes FOR SELECT USING (true);
CREATE POLICY "Enviar mensajes"        ON public.mensajes FOR INSERT WITH CHECK (true);
CREATE POLICY "Marcar mensajes leidos" ON public.mensajes FOR UPDATE USING (true);

-- ── 2. TABLA NOTIFICACIONES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id_notificacion BIGSERIAL PRIMARY KEY,
  id_usuario      BIGINT NOT NULL REFERENCES public.usuarios(id_usuario),
  tipo            VARCHAR(30) NOT NULL, -- 'like', 'comment', 'announcement'
  titulo          VARCHAR(255) NOT NULL,
  cuerpo          TEXT,
  leida           BOOLEAN DEFAULT FALSE,
  id_referencia   BIGINT,               -- id_publicacion o id_evento relacionado
  fecha_creacion  TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_usuario ON public.notificaciones(id_usuario, fecha_creacion DESC);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leer notificaciones propias"   ON public.notificaciones;
DROP POLICY IF EXISTS "Insertar notificacion"         ON public.notificaciones;
DROP POLICY IF EXISTS "Actualizar notificacion"       ON public.notificaciones;

CREATE POLICY "Leer notificaciones propias" ON public.notificaciones FOR SELECT USING (true);
CREATE POLICY "Insertar notificacion"       ON public.notificaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualizar notificacion"     ON public.notificaciones FOR UPDATE USING (true);

-- ── 3. TRIGGER: notificación automática en likes ───────────────
CREATE OR REPLACE FUNCTION public.fn_notificar_like()
RETURNS trigger AS $$
DECLARE
  v_id_autor   BIGINT;
  v_titulo     TEXT;
  v_push_token TEXT;
BEGIN
  SELECT id_usuario, LEFT(contenido_texto, 60)
    INTO v_id_autor, v_titulo
    FROM public.publicaciones
   WHERE id_publicacion = NEW.id_publicacion;

  IF v_id_autor IS DISTINCT FROM NEW.id_usuario THEN
    -- Insertar notificación in-app
    INSERT INTO public.notificaciones(id_usuario, tipo, titulo, cuerpo, id_referencia)
    VALUES(v_id_autor, 'like', 'Tu publicación recibió un ❤️', COALESCE(v_titulo,''), NEW.id_publicacion);

    -- Obtener push token del autor
    SELECT push_token INTO v_push_token FROM public.usuarios WHERE id_usuario = v_id_autor;

    -- Llamar Edge Function si tiene token
    IF v_push_token IS NOT NULL THEN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'token',   v_push_token,
          'titulo',  'Tu publicación recibió un ❤️',
          'cuerpo',  COALESCE(v_titulo, 'Alguien le dio like a tu publicación')
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificar_like ON public.likes_publicacion;
CREATE TRIGGER trg_notificar_like
  AFTER INSERT ON public.likes_publicacion
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_like();

-- ── 4. TRIGGER: notificación automática en comentarios ─────────
CREATE OR REPLACE FUNCTION public.fn_notificar_comentario()
RETURNS trigger AS $$
DECLARE
  v_id_autor   BIGINT;
  v_push_token TEXT;
BEGIN
  SELECT id_usuario INTO v_id_autor
    FROM public.publicaciones WHERE id_publicacion = NEW.id_publicacion;

  IF v_id_autor IS DISTINCT FROM NEW.id_usuario THEN
    INSERT INTO public.notificaciones(id_usuario, tipo, titulo, cuerpo, id_referencia)
    VALUES(v_id_autor, 'comment', 'Nuevo comentario en tu publicación 💬', LEFT(NEW.contenido,80), NEW.id_publicacion);

    SELECT push_token INTO v_push_token FROM public.usuarios WHERE id_usuario = v_id_autor;

    IF v_push_token IS NOT NULL THEN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'token',  v_push_token,
          'titulo', 'Nuevo comentario en tu publicación 💬',
          'cuerpo', LEFT(NEW.contenido, 80)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notificar_comentario ON public.comentarios;
CREATE TRIGGER trg_notificar_comentario
  AFTER INSERT ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_comentario();

-- ── 5. FUNCIÓN: obtener conversaciones del usuario ─────────────
CREATE OR REPLACE FUNCTION public.fn_mis_conversaciones(p_id_usuario BIGINT)
RETURNS TABLE (
  id_otro_usuario  BIGINT,
  nombre           VARCHAR,
  apellidos        VARCHAR,
  foto_url         VARCHAR,
  ultimo_mensaje   TEXT,
  fecha_ultimo     TIMESTAMP,
  no_leidos        BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (otro.id_usuario)
    otro.id_usuario,
    COALESCE(pa.nombre, pp.nombre)::VARCHAR,
    COALESCE(pa.apellidos, pp.apellidos)::VARCHAR,
    COALESCE(pa.foto_perfil_url, pp.foto_perfil_url)::VARCHAR,
    m_last.contenido,
    m_last.fecha_envio,
    (SELECT COUNT(*) FROM public.mensajes
      WHERE id_receptor = p_id_usuario
        AND id_emisor = otro.id_usuario
        AND leido = FALSE)
  FROM public.mensajes m
  JOIN public.usuarios otro ON otro.id_usuario = CASE
    WHEN m.id_emisor = p_id_usuario THEN m.id_receptor
    ELSE m.id_emisor
  END
  LEFT JOIN public.perfiles_alumna  pa ON pa.id_usuario = otro.id_usuario
  LEFT JOIN public.perfiles_ponente pp ON pp.id_usuario = otro.id_usuario
  JOIN LATERAL (
    SELECT contenido, fecha_envio
    FROM public.mensajes
    WHERE (id_emisor = p_id_usuario AND id_receptor = otro.id_usuario)
       OR (id_receptor = p_id_usuario AND id_emisor = otro.id_usuario)
    ORDER BY fecha_envio DESC
    LIMIT 1
  ) m_last ON TRUE
  WHERE m.id_emisor = p_id_usuario OR m.id_receptor = p_id_usuario
  ORDER BY otro.id_usuario, m_last.fecha_envio DESC;
END;
$$;

-- ── 6. FUNCIÓN: obtener usuarios para iniciar conversación ─────
CREATE OR REPLACE FUNCTION public.fn_buscar_usuarios(p_busqueda TEXT, p_excluir BIGINT)
RETURNS TABLE (
  id_usuario BIGINT,
  nombre     VARCHAR,
  apellidos  VARCHAR,
  foto_url   VARCHAR,
  rol        VARCHAR
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id_usuario,
    COALESCE(pa.nombre, pp.nombre)::VARCHAR,
    COALESCE(pa.apellidos, pp.apellidos)::VARCHAR,
    COALESCE(pa.foto_perfil_url, pp.foto_perfil_url)::VARCHAR,
    r.nombre_rol::VARCHAR
  FROM public.usuarios u
  LEFT JOIN public.perfiles_alumna  pa ON pa.id_usuario = u.id_usuario
  LEFT JOIN public.perfiles_ponente pp ON pp.id_usuario = u.id_usuario
  JOIN public.roles r ON r.id_rol = u.id_rol
  WHERE u.id_usuario != p_excluir
    AND u.activo = 1
    AND (
      LOWER(COALESCE(pa.nombre, pp.nombre, '')) ILIKE '%' || LOWER(p_busqueda) || '%'
      OR LOWER(COALESCE(pa.apellidos, pp.apellidos, '')) ILIKE '%' || LOWER(p_busqueda) || '%'
      OR LOWER(u.correo) ILIKE '%' || LOWER(p_busqueda) || '%'
    )
  LIMIT 20;
END;
$$;

-- ── 7. FUNCIÓN: marcar mensajes como leídos ────────────────────
CREATE OR REPLACE FUNCTION public.fn_marcar_leidos(p_id_emisor BIGINT, p_id_receptor BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.mensajes
  SET leido = TRUE
  WHERE id_emisor = p_id_emisor AND id_receptor = p_id_receptor AND leido = FALSE;
END;
$$;

-- ── 8. FUNCIÓN: reset password via Resend ─────────────────────
-- Esta función genera un token temporal; el email lo envía la Edge Function
CREATE OR REPLACE FUNCTION public.fn_reset_password(
  p_correo           TEXT,
  p_token            TEXT,
  p_nueva_contrasena TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id       BIGINT;
  v_expiry   TIMESTAMP;
BEGIN
  SELECT id_usuario, reset_token_expiry
    INTO v_id, v_expiry
    FROM public.usuarios
   WHERE correo = LOWER(TRIM(p_correo))
     AND reset_token = p_token
     AND activo = 1;
 
  -- Token no encontrado
  IF v_id IS NULL THEN RETURN FALSE; END IF;
 
  -- Token expirado
  IF v_expiry < NOW() THEN RETURN FALSE; END IF;
 
  -- Actualizar contraseña y limpiar token
  UPDATE public.usuarios SET
    contrasena_hash    = crypt(p_nueva_contrasena, gen_salt('bf')),
    reset_token        = NULL,
    reset_token_expiry = NULL
  WHERE id_usuario = v_id;
 
  RETURN TRUE;
END;
$$;

-- Verificar creación
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('mensajes', 'notificaciones');

-- ── 9. COLUMNAS PARA RESET TOKEN ──────────────────────────────
-- Necesarias para la Edge Function de reset de contraseña
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;

-- ═══════════════════════════════════════════════════════════════
-- PUSH NOTIFICATIONS SETUP
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Columna para guardar el Expo Push Token del dispositivo
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Función para guardar/actualizar push token
CREATE OR REPLACE FUNCTION public.fn_guardar_push_token(
  p_id_usuario BIGINT,
  p_token      TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.usuarios SET push_token = p_token WHERE id_usuario = p_id_usuario;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_push_token_autor(p_id_publicacion BIGINT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token TEXT;
BEGIN
  SELECT u.push_token INTO v_token
  FROM public.publicaciones p
  JOIN public.usuarios u ON u.id_usuario = p.id_usuario
  WHERE p.id_publicacion = p_id_publicacion;
  RETURN v_token;
END;
$$;
-- 5. Habilitar extensión http (necesaria para llamar Edge Functions desde triggers)
CREATE EXTENSION IF NOT EXISTS http;
-- Nota: si "http" no está disponible, usar pg_net:
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- Y reemplazar net.http_post por pg_net.http_post
ALTER TABLE perfiles_alumna ADD COLUMN IF NOT EXISTS semblanza TEXT;

UPDATE usuarios
SET id_usuario = (SELECT id_usuario FROM usuarios WHERE nombre_rol = 'admin')
WHERE correo = 'braulio.pacheco06@gmail.com';
-- ── 1. Columna dedicada para el link (separada de imagen/archivo) ───────
ALTER TABLE public.publicaciones
  ADD COLUMN IF NOT EXISTS link_url TEXT;

-- ── 2. Tabla para múltiples adjuntos (imágenes y/o archivos) por post ───
CREATE TABLE IF NOT EXISTS public.archivos_publicacion (
  id_archivo       BIGSERIAL PRIMARY KEY,
  id_publicacion    BIGINT NOT NULL REFERENCES public.publicaciones(id_publicacion) ON DELETE CASCADE,
  url               TEXT NOT NULL,
  tipo_archivo      VARCHAR(20) NOT NULL CHECK (tipo_archivo IN ('imagen', 'archivo')),
  nombre_original   TEXT,
  fecha_creacion    TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archivos_publicacion ON public.archivos_publicacion(id_publicacion);

ALTER TABLE public.archivos_publicacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leer archivos de publicacion" ON public.archivos_publicacion;
DROP POLICY IF EXISTS "Insertar archivos de publicacion" ON public.archivos_publicacion;
DROP POLICY IF EXISTS "Eliminar archivos de publicacion" ON public.archivos_publicacion;

CREATE POLICY "Leer archivos de publicacion"
  ON public.archivos_publicacion FOR SELECT USING (true);

CREATE POLICY "Insertar archivos de publicacion"
  ON public.archivos_publicacion FOR INSERT WITH CHECK (true);

CREATE POLICY "Eliminar archivos de publicacion"
  ON public.archivos_publicacion FOR DELETE USING (true);

-- ── 3. Migrar datos existentes hacia las nuevas columnas (best-effort) ──
INSERT INTO public.archivos_publicacion (id_publicacion, url, tipo_archivo)
SELECT id_publicacion, url_referencia, 'imagen'
FROM public.publicaciones
WHERE url_referencia IS NOT NULL AND descripcion_url = 'Imagen adjunta';

INSERT INTO public.archivos_publicacion (id_publicacion, url, tipo_archivo)
SELECT id_publicacion, url_referencia, 'archivo'
FROM public.publicaciones
WHERE url_referencia IS NOT NULL AND descripcion_url = 'Archivo adjunto';

UPDATE public.publicaciones
SET link_url = url_referencia
WHERE url_referencia IS NOT NULL AND descripcion_url = 'Enlace adjunto';