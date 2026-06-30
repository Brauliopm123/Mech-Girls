import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar sesión válida
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar que es admin (id_rol = 3)
    const { data: adminCheck } = await supabaseAdmin
      .from('usuarios')
      .select('id_rol')
      .eq('auth_user_id', user.id)
      .single()

    if (adminCheck?.id_rol !== 3) {
      return new Response(JSON.stringify({ error: 'Se requiere rol admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const {
      correo,
      nombre,
      apellidos,
      especialidad,
      empresa,
      semblanza,
      sitio_web_url,
      id_solicitud,
    } = await req.json()

    if (!correo || !nombre || !apellidos) {
      return new Response(JSON.stringify({ error: 'correo, nombre y apellidos son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Crear cuenta pasando id_rol=2 en metadata para que el trigger
    //    fn_sync_auth_usuario cree perfiles_ponente directamente (no perfiles_alumna)
    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: correo.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { nombre, apellidos, id_rol: 2 },
    })
    if (createError) throw createError

    // Esperar al trigger fn_sync_auth_usuario
    await new Promise(r => setTimeout(r, 800))

    // 2. Obtener id_usuario creado por el trigger
    const { data: usuarioNuevo, error: rolError } = await supabaseAdmin
      .from('usuarios')
      .select('id_usuario')
      .eq('auth_user_id', authUser.user.id)
      .single()
    if (rolError) throw rolError

    const id_usuario = usuarioNuevo.id_usuario

    // 3. Actualizar el perfil_ponente (ya creado por el trigger) con semblanza y demás campos
    const { error: perfilError } = await supabaseAdmin
      .from('perfiles_ponente')
      .update({
        nombre:              nombre.trim(),
        apellidos:           apellidos.trim(),
        especialidad:        especialidad?.trim()    || null,
        empresa_institucion: empresa?.trim()         || null,
        semblanza:           semblanza?.trim()       || null,
        sitio_web_url:       sitio_web_url?.trim()   || null,
      })
      .eq('id_usuario', id_usuario)
    if (perfilError) throw perfilError

    // 4. Marcar la solicitud como aprobada (si viene de una)
    if (id_solicitud) {
      await supabaseAdmin
        .from('solicitudes_ponente')
        .update({ estado: 'aprobada', fecha_resolucion: new Date().toISOString() })
        .eq('id_solicitud', id_solicitud)
    }

    // 5. Generar link de reset para que el ponente establezca su contraseña
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: correo.trim().toLowerCase(),
    })

    return new Response(
      JSON.stringify({ success: true, id_usuario }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})