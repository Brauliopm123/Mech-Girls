import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record?.id_usuario) {
      return new Response('sin id_usuario', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('push_token')
      .eq('id_usuario', record.id_usuario)
      .maybeSingle();

    if (error || !usuario?.push_token) {
      return new Response('usuario sin token', { status: 200 });
    }

    const mensaje = {
      to: usuario.push_token,
      sound: 'default',
      title: record.titulo ?? 'Mech Girls',
      body: record.cuerpo ?? '',
      data: { tipo: record.tipo, id_referencia: record.id_referencia },
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(mensaje),
    });

    const resultado = await res.json();
    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 200 });
  }
});