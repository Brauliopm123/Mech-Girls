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

    // Verificar que quien llama tiene sesión válida
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

    const { correo, nombre, apellidos, especialidad, empresa } = await req.json()

    if (!correo || !nombre || !apellidos) {
      return new Response(JSON.stringify({ error: 'correo, nombre y apellidos son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Crear en Supabase Auth — email_confirm: true, sin contraseña
    //    El ponente recibirá un email para establecer su contraseña
    const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: correo.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { nombre, apellidos },
    })
    if (createError) throw createError

    // Esperar a que el trigger fn_sync_auth_usuario ejecute
    await new Promise(r => setTimeout(r, 600))

    // 2. Cambiar rol a ponente (el trigger lo creó como alumna por defecto)
    const { data: usuarioNuevo, error: rolError } = await supabaseAdmin
      .from('usuarios')
      .update({ id_rol: 2 })
      .eq('auth_user_id', authUser.user.id)
      .select('id_usuario')
      .single()
    if (rolError) throw rolError

    const id_usuario = usuarioNuevo.id_usuario

    // 3. Eliminar perfil_alumna creado por el trigger y crear perfil_ponente
    await supabaseAdmin.from('perfiles_alumna').delete().eq('id_usuario', id_usuario)

    const { error: perfilError } = await supabaseAdmin
      .from('perfiles_ponente')
      .insert({
        id_usuario,
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        especialidad: especialidad?.trim() || null,
        empresa_institucion: empresa?.trim() || null,
      })
    if (perfilError) throw perfilError

    // 4. Generar link de reset para que establezca su contraseña
    //    Solo llega si el correo es real — si es falso simplemente falla silenciosamente
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