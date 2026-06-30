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
);

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
    temario text,
    nombre_ponente text;
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

Datos iniciales: roles
INSERT INTO public.roles (id_rol, nombre_rol) VALUES
  (1, 'alumna'),
  (2, 'ponente'),
  (3, 'admin')
ON CONFLICT DO NOTHING;


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

Políticas básicas de lectura
CREATE POLICY "Leer usuarios autenticados"
  ON public.usuarios FOR SELECT USING (true);

CREATE POLICY "Leer publicaciones"
  ON public.publicaciones FOR SELECT
  USING (true);

CREATE POLICY "Leer eventos"
  ON public.eventos FOR SELECT
  USING (true);

CREATE POLICY "Leer ponentes"
  ON public.perfiles_ponente FOR SELECT USING (true);

CREATE POLICY "Insertar publicacion propia"
  ON public.publicaciones FOR INSERT WITH CHECK (true);

CREATE POLICY "Insertar comentario"
  ON public.comentarios FOR INSERT
  WITH CHECK (
    id_usuario = public.fn_mi_id_usuario()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Insertar like"
  ON public.likes_publicacion FOR INSERT
  WITH CHECK (
    id_usuario = public.fn_mi_id_usuario()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Inscribirse a evento"
  ON public.inscripciones FOR INSERT
  WITH CHECK (
    id_usuario = public.fn_mi_id_usuario()
    AND auth.uid() IS NOT NULL
  );

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leer roles"
  ON public.roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_alumna  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_ponente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes_publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insertar publicacion"
  ON public.publicaciones FOR INSERT
  WITH CHECK (
    id_usuario = public.fn_mi_id_usuario()
    AND auth.uid() IS NOT NULL
  );
  
CREATE POLICY "Actualizar perfil ponente"
  ON public.perfiles_ponente FOR UPDATE
  USING (id_usuario = public.fn_mi_id_usuario())
  WITH CHECK (id_usuario = public.fn_mi_id_usuario());

CREATE POLICY "Actualizar perfil alumna"
  ON public.perfiles_alumna FOR UPDATE
  USING (id_usuario = public.fn_mi_id_usuario())
  WITH CHECK (id_usuario = public.fn_mi_id_usuario());

 
CREATE POLICY "Leer usuarios"
  ON public.usuarios FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leer perfil alumna"
  ON public.perfiles_alumna FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leer perfil ponente"
  ON public.perfiles_ponente FOR SELECT
  USING (auth.uid() IS NOT NULL);
  
CREATE POLICY "Insertar perfil ponente"
  ON public.perfiles_ponente FOR INSERT
  WITH CHECK (id_usuario = public.fn_mi_id_usuario());

CREATE POLICY "Leer likes"
  ON public.likes_publicacion FOR SELECT
  USING (true);

CREATE POLICY "Eliminar like"
  ON public.likes_publicacion FOR DELETE
  USING (id_usuario = public.fn_mi_id_usuario());

CREATE POLICY "Leer comentarios"
  ON public.comentarios FOR SELECT
  USING (true);

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
  (SELECT count(*) FROM likes_publicacion lp WHERE lp.id_publicacion = p.id_publicacion) AS likes,
  (SELECT count(*) FROM comentarios c WHERE c.id_publicacion = p.id_publicacion) AS comments,
  COALESCE((SELECT json_agg(json_build_object('id', ap.id_archivo, 'url', ap.url, 'tipo', ap.tipo_archivo, 'nombre', ap.nombre_original))
            FROM archivos_publicacion ap
            WHERE ap.id_publicacion = p.id_publicacion), '[]'::json) AS archivos,
  EXISTS (
    SELECT 1 FROM likes_publicacion lp2
    WHERE lp2.id_publicacion = p.id_publicacion
    AND lp2.id_usuario = fn_mi_id_usuario()
  ) AS usuario_dio_like
FROM publicaciones p
LEFT JOIN perfiles_alumna pa ON pa.id_usuario = p.id_usuario
LEFT JOIN perfiles_ponente pp ON pp.id_usuario = p.id_usuario;

-- Política para subir archivos al bucket media
CREATE POLICY "Subir archivos media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);

-- Política para leer archivos públicamente
CREATE POLICY "Leer archivos media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Política para eliminar archivos propios
CREATE POLICY "Eliminar archivos media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Leer inscripciones"
  ON public.inscripciones FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Actualizar inscripcion propia"
  ON public.inscripciones FOR UPDATE
  USING (id_usuario = public.fn_mi_id_usuario());


CREATE POLICY "Insertar evento"
  ON public.eventos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE auth_user_id = auth.uid() AND id_rol IN (1, 2, 3)
    )
  );

CREATE POLICY "Actualizar evento"
  ON public.eventos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE auth_user_id = auth.uid() AND id_rol IN (2, 3)
    )
  );

CREATE POLICY "Eliminar evento"
  ON public.eventos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE auth_user_id = auth.uid() AND id_rol IN (2, 3)
    )
  );
-- ── 1. Editar publicación ───────────────────────────────────────────────
DROP function public.fn_editar_publicacion()
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

CREATE POLICY "Leer mensajes propios"
  ON public.mensajes FOR SELECT
  USING (
    id_emisor   = public.fn_mi_id_usuario()
    OR id_receptor = public.fn_mi_id_usuario()
  );

CREATE POLICY "Enviar mensajes"
  ON public.mensajes FOR INSERT
  WITH CHECK (
    id_emisor = public.fn_mi_id_usuario()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Marcar mensajes leidos"
  ON public.mensajes FOR UPDATE
  USING (id_receptor = public.fn_mi_id_usuario());

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

CREATE POLICY "Leer notificaciones propias"
  ON public.notificaciones FOR SELECT
  USING (id_usuario = public.fn_mi_id_usuario());

CREATE POLICY "Actualizar notificacion"
  ON public.notificaciones FOR UPDATE
  USING (id_usuario = public.fn_mi_id_usuario());

CREATE POLICY "Insertar notificacion"
  ON public.notificaciones FOR INSERT
  WITH CHECK (true);

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

CREATE POLICY "Leer archivos de publicacion"
  ON public.archivos_publicacion FOR SELECT
  USING (true);

CREATE POLICY "Insertar archivos de publicacion"
  ON public.archivos_publicacion FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.publicaciones
      WHERE id_publicacion = archivos_publicacion.id_publicacion
        AND id_usuario = public.fn_mi_id_usuario()
    )
  );

CREATE POLICY "Eliminar archivos de publicacion"
  ON public.archivos_publicacion FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.publicaciones
      WHERE id_publicacion = archivos_publicacion.id_publicacion
        AND id_usuario = public.fn_mi_id_usuario()
    )
  );

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

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.fn_mi_id_usuario()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id_usuario
  FROM public.usuarios
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_auth_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nuevo_id    BIGINT;
  v_nombre    TEXT;
  v_apellidos TEXT;
  v_id_rol    INTEGER;
BEGIN
  v_nombre    := COALESCE(NEW.raw_user_meta_data->>'nombre',    'Sin nombre');
  v_apellidos := COALESCE(NEW.raw_user_meta_data->>'apellidos', '');
  -- Respetar el rol que pasa el signUp (alumna=1, ponente=2, admin=3)
  -- Si no viene en el metadata, default a alumna (1)
  v_id_rol    := COALESCE((NEW.raw_user_meta_data->>'id_rol')::INTEGER, 1);
 
  INSERT INTO public.usuarios (correo, id_rol, activo, auth_user_id)
  VALUES (NEW.email, v_id_rol, 1, NEW.id)
  RETURNING id_usuario INTO nuevo_id;
 
  -- Alumna y Admin → perfiles_alumna; Ponente → perfiles_ponente
  IF v_id_rol = 1 OR v_id_rol = 3 THEN
    INSERT INTO public.perfiles_alumna (id_usuario, nombre, apellidos)
    VALUES (nuevo_id, v_nombre, v_apellidos);
  ELSIF v_id_rol = 2 THEN
    INSERT INTO public.perfiles_ponente (id_usuario, nombre, apellidos)
    VALUES (nuevo_id, v_nombre, v_apellidos);
  END IF;
 
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_auth_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_auth_usuario();

UPDATE public.usuarios SET auth_user_id = '2aeb7e68-c102-435b-a38b-96ac8c784eec' WHERE correo = 'luisa@uteq.com';
UPDATE public.usuarios SET auth_user_id = 'ba627f39-965a-4911-a24e-1ffcd2a70780' WHERE correo = 'lau@uteq.com';
UPDATE public.usuarios SET auth_user_id = '2f078ca3-c25b-4995-be53-213bde3a3f56' WHERE correo = 'susi@uteq.com';
UPDATE public.usuarios SET auth_user_id = '319a6a3d-f943-46b8-af1c-afc8111ad0f1' WHERE correo = 'braulio@uteq.com';
UPDATE public.usuarios SET auth_user_id = 'e811ed37-9f0b-4b15-ae82-8326c675a287' WHERE correo = 'diego@gmail.com';
UPDATE public.usuarios SET auth_user_id = '8aed83e5-5012-40e7-b751-b192de6fcbe1' WHERE correo = 'carmen@uteq.com';
UPDATE public.usuarios SET auth_user_id = '62f6818a-49ce-4a58-a3a8-27e9d504715e' WHERE correo = 'sam@gmail.com';
UPDATE public.usuarios SET auth_user_id = 'e6dbb827-20fe-4329-9d15-a042ed425922' WHERE correo = 'mariacontreras@gmail.com';
UPDATE public.usuarios SET auth_user_id = '1507edbc-9c0e-4501-a9db-87379ae03fc4' WHERE correo = 'braulio.pacheco06@gmail.com';
UPDATE public.usuarios SET auth_user_id = '0148ee08-cbe6-4f88-9c96-f7b23d89c871' WHERE correo = '2024310092@uteq.edu.mx';
UPDATE public.usuarios SET auth_user_id = '31e98945-cf6c-4484-be77-12ae31bbac0d' WHERE correo = 'prueba@gmail.com';
 
CREATE POLICY "Leer perfil ponente"
  ON public.perfiles_ponente FOR SELECT
  USING (auth.uid() IS NOT NULL);
 
CREATE POLICY "Actualizar publicacion propia"
  ON public.publicaciones FOR UPDATE
  USING (id_usuario = public.fn_mi_id_usuario())
  WITH CHECK (id_usuario = public.fn_mi_id_usuario());
 
CREATE POLICY "Eliminar publicacion propia"
  ON public.publicaciones FOR DELETE
  USING (id_usuario = public.fn_mi_id_usuario());
 
CREATE POLICY "Eliminar comentario propio"
  ON public.comentarios FOR DELETE
  USING (id_usuario = public.fn_mi_id_usuario());